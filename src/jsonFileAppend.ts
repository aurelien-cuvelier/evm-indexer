import fs from "fs";

/**
 * @TODO
 * This will be exported as an npm package later once optimized & proven to be running fine
 * Implement rollback mechanism
 * Implement an async writing method that won't block event loop
 * A stringifier should be able to passed in constructor
 */

enum JSONSymbols {
  OBJECT_START = 0x7b, //{
  OBJECT_END = 0x7d, //}
  STRING_START = 0x22, //"
  STRING_END = 0x22, //"
  ARRAY_START = 0x5b, //[
  ARRAY_END = 0x5d, //]
  COMMA = 0x2c, //,
}

export class JsonFileAppendor<T> {
  private _filePath: string;
  private _fileDescriptor;
  private _fileStats;
  private _safeToWrite = true;

  //Variables for benchmarking, won't stay
  private _totalBytesWritten = 0;
  private _totalMsWritting = 0;

  constructor(filePath: string) {
    this._filePath = filePath;

    this._fileDescriptor = fs.openSync(this._filePath, "a+");
    this._fileStats = fs.fstatSync(this._fileDescriptor);
  }

  writeSync(elements: T[]) {
    const start = Date.now();
    let bytesWritten = 0;
    if (this._fileStats.size === 0) {
      bytesWritten = fs.writeSync(
        this._fileDescriptor,
        this._stringifier(elements)
      );
    } else {
      //If the file is not empty we move the pointer one byte left
      //fs.ftruncateSync(this._fileDescriptor, this._fileStats.size - 1);
      this._truncateFile(this._fileDescriptor, this._fileStats.size - 1);

      const comma = this._fileStats.size > 2 ? `,` : "";
      bytesWritten = fs.writeSync(
        this._fileDescriptor,
        `${comma}${this._stringifier(elements).substring(1)}`
      );
    }

    //Why this does not update on its own??
    this._fileStats = fs.fstatSync(this._fileDescriptor);

    this._totalMsWritting += Date.now() - start;
    this._totalBytesWritten += bytesWritten;

    console.log(
      `JsonFileAppendor: avg. writing ${(
        this._totalBytesWritten / this._totalMsWritting
      ).toFixed()} bytes/ms`
    );
  }

  private _truncateFile(fd: number, len?: number | null) {
    fs.ftruncateSync(fd, len);
    //fs.writeSync(this._fileDescriptor, "]");
  }

  private _readChunk() {}

  rollback2<K extends keyof T>(
    keyToFilter: K,
    shoudDelete: (value: T[K]) => boolean
  ): void {
    this._safeToWrite = false;
    let chunkSize = 1e7; //1MB mutable because of the last chunk to read which probably wont fill the whole initial chunk size

    if (chunkSize > this._fileStats.size) {
      chunkSize = this._fileStats.size;
    }

    const buffer = Buffer.alloc(chunkSize, undefined, "utf8");
    let position = this._fileStats.size;
    let readFromPosition = position;
    let totalReadBytes = 0;
    let totalParsedElements = 0;

    let globalArrayDepth = 0;
    //let globalObjectDepth = 0;
    //let globalStringDepth = 0;
    let lastClosingCommaByteOffset = 0;

    let realReadPosition = readFromPosition - chunkSize;

    const start = Date.now();
    console.log("STARTING");
    do {
      let elemArrayDepth = 0;
      let elemObjectDepth = 0;
      let elemInString = false;

      const elementBuffer = [] as number[];

      realReadPosition = readFromPosition - chunkSize;

      if (readFromPosition - chunkSize < 0) {
        console.log("CHUNK SIZE TO ZERO");
        chunkSize = readFromPosition;
        realReadPosition = 0;
      }

      const readBytes = fs.readSync(
        this._fileDescriptor,
        buffer,
        0,
        chunkSize,
        realReadPosition
      );

      // console.log("RAW READ BYTES:");
      // console.log(buffer.toString());
      // console.log("===========================================");

      let parsedElement = false;
      for (let i = readBytes - 1; i >= 0; i--) {
        const byte = buffer[i];
        //console.log(Buffer.from([byte]).toString());

        if (byte === JSONSymbols.STRING_END) {
          /**
           * @DEV
           * Valid for both keys/values but not important here, the point is not to count some symbols
           * as delimiters of an array/object if they are inside of a string.
           */

          elemInString = !elemInString;
        }

        if (elemInString) {
          /**
           * @DEV Anything inside of a string should be pushed to the buffer, but any JSON symbol inside
           * of a string should not be considered as a JSON symbol
           */
          elementBuffer.push(byte);
          continue;
        }

        switch (byte) {
          case JSONSymbols.ARRAY_END: {
            globalArrayDepth++;

            if (globalArrayDepth === 1) {
              break;
            }

            elemArrayDepth++;
            elementBuffer.push(byte);
            break;
          }

          case JSONSymbols.ARRAY_START: {
            globalArrayDepth--;

            if (globalArrayDepth === 0) {
              lastClosingCommaByteOffset =
                this._fileStats.size - (totalReadBytes + (readBytes - i));

              // console.log(
              //   `lastClosingCommaByteOffset: ${lastClosingCommaByteOffset}`
              // );

              parsedElement = true;

              break;
            }
            elemArrayDepth--;
            elementBuffer.push(byte);
            break;
          }

          case JSONSymbols.OBJECT_END: {
            elemObjectDepth++;
            //globalObjectDepth++;
            elementBuffer.push(byte);
            break;
          }

          case JSONSymbols.OBJECT_START: {
            elemObjectDepth--;
            //globalObjectDepth--;
            elementBuffer.push(byte);

            break;
          }

          case JSONSymbols.COMMA: {
            if (elemObjectDepth > 0) {
              elementBuffer.push(byte);
              break;
            }

            lastClosingCommaByteOffset =
              this._fileStats.size - (totalReadBytes + (readBytes - i));

            // console.log(
            //   `lastClosingCommaByteOffset: ${lastClosingCommaByteOffset}`
            // );

            parsedElement = true;

            break;
          }

          default: {
            elementBuffer.push(byte);
          }
        }

        if (parsedElement) {
          elementBuffer.reverse();
          const stringified = Buffer.from(elementBuffer).toString("utf-8");

          // console.log(`Trying to parse:`);
          // console.log(stringified);
          const parsed = JSON.parse(stringified);
          // Buffer.from(elementBuffer.reverse()).toString("utf-8");
          // elementBuffer.reverse();

          //console.log(parsed);
          elementBuffer.length = 0;
          totalParsedElements++;
          parsedElement = false;
        }
      }

      globalArrayDepth -= elemArrayDepth;
      readFromPosition = lastClosingCommaByteOffset;

      //totalReadBytes += readBytes;
      totalReadBytes = this._fileStats.size - lastClosingCommaByteOffset;
    } while (realReadPosition > 0);

    console.log(`DONE IN ${(Date.now() - start) / 1000} s`);
    console.log(`Went through ${totalParsedElements} elements`);
  }

  // console.log(`bufferObjectDepth: ${bufferObjectDepth}`);
  // console.log(Buffer.from(elementBuffer.reverse()).toString());
  // elementBuffer.reverse();

  getLastElement() {}

  private _stringifier(data: object): string {
    return JSON.stringify(
      data,
      (_, value) => {
        if (typeof value === "bigint") {
          return "0x" + value.toString(16);
        }

        return value;
      },
      "\t"
    );
  }
}
