import { IBasicModule } from "./basicModule";

export enum WorkSynchronizerPauseReasons {
  WAITING_NEW_CANONICAL_BLOCK = "WAITING_NEW_CANONICAL_BLOCK",
  WAITING_FOR_REORG_WORK_TO_END = "WAITING_FOR_REORG_WORK_TO_END",
}

export interface IWorkSynchronizer extends IBasicModule {
  paused: boolean;
  pausePromise: Promise<void>;
  pauseReason?: WorkSynchronizerPauseReasons;
  resumeWork(): void;
  pauseWork(reason: WorkSynchronizerPauseReasons): void;
  changePauseReason(newReason: WorkSynchronizerPauseReasons): void;
}
