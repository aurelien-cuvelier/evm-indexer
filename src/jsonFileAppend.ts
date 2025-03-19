import fs from "fs";

/**
 * @TODO
 * This will be exported as an npm package later once optimized & proven to be running fine
 * Implement rollback mechanism
 * Implement an async writing method that won't block event loop
 * A stringifier should be able to passed in constructor
 */

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
      fs.ftruncateSync(this._fileDescriptor, this._fileStats.size - 1);

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

  rollback<K extends keyof T>(
    keyToFilter: K,
    /**
     * @DEV
     * The elements for which the return will be true will be truncated
     * The truncate process stops when THE FIRST element returning false is met
     */
    shoudDelete: (value: T[K]) => boolean
  ): void {
    /**
     * @DEV
     * Since this should work with any type of data, the rollback will search for the first element
     * in the array for which there is a match with the provided key/value, and then truncate the file
     * from this index and close the array back again with a "]". This implies that you array should be ordered.
     * This is async since we will use a stream
     */

    this._safeToWrite = false;

    let chunkSize = 1024; //mutable because of the last element which probably wont fill the whole chunk
    const buffer = Buffer.alloc(chunkSize, undefined, "utf8");
    let position = this._fileStats.size;

    let nestLevel = 0;
    let lastRowSeperatorIndex = 0;
    let totalReadBytes = 0;
    while (true) {
      if (lastRowSeperatorIndex) {
        position -= lastRowSeperatorIndex;
      }

      if (position - chunkSize < 0) {
        buffer.fill(0);
        chunkSize = position;
      }
      const readFromPosition = position - chunkSize;

      console.log(
        `read position: ${readFromPosition} 0x${readFromPosition.toString(
          16
        )}  chunk size: ${chunkSize} 0x${chunkSize.toString(16)}`
      );
      const readBytes = fs.readSync(
        this._fileDescriptor,
        buffer,
        0,
        chunkSize,
        readFromPosition
      );

      console.log(`=============START OF RAW DATA================`);
      console.log(buffer.toString("utf-8"));
      console.log(`=============END OF RAW DATA================`);

      totalReadBytes += readBytes;

      //console.log(`Reading file from: ${}`)

      const elementBuffer = [] as number[];
      nestLevel = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        /**
         * @DEV
         * Anything where nestLevel > 0 should be added in the buffer
         *
         */
        const byte = buffer[i];

        if (nestLevel === 0 && byte === 0x2c) {
          //0x22 => ,
          lastRowSeperatorIndex = buffer.length - i;
          //lastRowSeperatorIndex += buffer.length - i;
          console.log(`new lastRowSeperatorIndex: ${lastRowSeperatorIndex}`);
        }

        if (nestLevel > 0) {
          elementBuffer.push(byte);
        }

        if (byte === 0x7d) {
          //0x7d => }
          if (nestLevel === 0) {
            elementBuffer.push(byte);
          }
          nestLevel++;
          continue;
        }

        if (byte === 0x7b && nestLevel === 1) {
          //0x7b => {
          nestLevel--;
          console.log(`==========PARSED ELEMENT==================`);
          const parsed = JSON.parse(
            Buffer.from(elementBuffer.reverse()).toString("utf-8")
          ) as T;
          console.log(parsed);
          const shouldDelete = shoudDelete(parsed[keyToFilter]);
          console.log(`shouldDelete: ${shouldDelete}`);
          if (!shouldDelete) {
            console.log(`Found first element that should not be filtered out!`);
            return;
          }
          elementBuffer.length = 0;

          continue;
        }

        //console.log(Buffer.from([byte]).toString("utf-8"));
      }

      if (readFromPosition === 0) {
        // console.log(
        //   JSON.parse(Buffer.from(elementBuffer.reverse()).toString("utf-8"))
        // );
        console.log(`EOF`);
        break;
      }
      console.log(`========================`);
    }
  }

  private _stringifier(data: object): string {
    return JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") {
        return "0x" + value.toString(16);
      }

      return value;
    });
  }
}
