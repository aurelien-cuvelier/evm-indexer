import { Logger } from "pino";
import {
  IWorkSynchronizer,
  WorkSynchronizerPauseReasons,
} from "../interfaces/workSynchronizer";

export class WorkSynchronizer implements IWorkSynchronizer {
  moduleName = "WorkSynchronizer";
  paused = false;
  pausePromise: Promise<void> = Promise.resolve();
  private resume!: () => void;
  pauseReason?: WorkSynchronizerPauseReasons;
  private logger: Logger;

  constructor(_logger: Logger) {
    this.logger = _logger.child({ subModule: this.moduleName });
  }

  resumeWork() {
    if (this.paused) {
      this.logger.info(`Resuming after ${this.pauseReason}`);
      this.paused = false;
      this.resume();
    }
  }

  pauseWork(reason: WorkSynchronizerPauseReasons) {
    if (!this.paused) {
      this.logger.info(`Pausing for ${reason}`);
      this.pauseReason = reason;
      this.paused = true;
      this.pausePromise = new Promise<void>((resolve) => {
        this.resume = resolve;
      });
    }
  }
}
