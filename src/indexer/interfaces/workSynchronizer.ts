import { IBasicModule } from "./basicModule";

export enum WorkSynchronizerPauseReasons {
  WAITING_NEW_CANONICAL_BLOCK = "WAITING_NEW_CANONICAL_BLOCK",
}

export interface IWorkSynchronizer extends IBasicModule {
  paused: boolean;
  pausePromise: Promise<void>;
  pauseReason?: WorkSynchronizerPauseReasons;
  resumeWork(): void;
  pauseWork(reason: WorkSynchronizerPauseReasons): void;
}
