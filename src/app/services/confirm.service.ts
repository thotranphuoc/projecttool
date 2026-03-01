import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../shared/components/confirm-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  /** Opens a Material confirm dialog. Returns true if user confirmed, false if cancelled or closed. */
  async open(config: ConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        confirmText: config.confirmText ?? 'Xác nhận',
        cancelText: config.cancelText ?? 'Hủy',
        confirmWarn: config.confirmWarn ?? false,
        ...config
      }
    });
    const result = await firstValueFrom(ref.afterClosed());
    return result === true;
  }
}
