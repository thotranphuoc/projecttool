import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorLogService } from './error-log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private errorLog = inject(ErrorLogService);

  handleError(error: unknown): void {
    this.errorLog.log(error, 'UncaughtError').catch(() => {});
    console.error('Uncaught error:', error);
  }
}
