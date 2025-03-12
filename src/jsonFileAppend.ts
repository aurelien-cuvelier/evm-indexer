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

  private _stringifier(data: object): string {
    return JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") {
        return "0x" + value.toString(16);
      }

      return value;
    });
  }
}
