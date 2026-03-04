import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AdminExportService } from '../../services/admin-export.service';

@Component({
  selector: 'app-admin-export',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="admin-page">
      <div class="page-header">
        <h1 class="page-title">Xuất dữ liệu</h1>
        <p class="text-muted text-sm">Admin có thể xuất CSV các thực thể chiến lược và công việc (UTF-8, mở được bằng Excel).</p>
      </div>

      @if (isExporting()) {
        <div class="exporting-bar">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Đang xuất...</span>
        </div>
      }

      <div class="card export-grid">
        <div class="export-section">
          <h3 class="export-section-title">Chiến lược</h3>
          <div class="export-buttons">
            <button mat-stroked-button (click)="runExport('visions')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Tầm nhìn
            </button>
            <button mat-stroked-button (click)="runExport('strategies')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Chiến lược
            </button>
            <button mat-stroked-button (click)="runExport('valueChain')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Chuỗi giá trị
            </button>
            <button mat-stroked-button (click)="runExport('ksf')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất KSF
            </button>
          </div>
        </div>
        <div class="export-section">
          <h3 class="export-section-title">OKR & Tasks</h3>
          <div class="export-buttons">
            <button mat-stroked-button (click)="runExport('objectives')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Objectives
            </button>
            <button mat-stroked-button (click)="runExport('keyResults')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Key Results
            </button>
            <button mat-stroked-button (click)="runExport('tasks')" [disabled]="isExporting()">
              <mat-icon>download</mat-icon> Xuất Tasks
            </button>
          </div>
        </div>
        <div class="export-section export-all">
          <button mat-flat-button color="primary" (click)="runExport('all')" [disabled]="isExporting()">
            <mat-icon>file_download</mat-icon> Xuất tất cả
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-page { max-width: 720px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 8px; font-size: 24px; font-weight: 700; }
    .text-muted { color: #64748b; }
    .text-sm { font-size: 14px; }
    .exporting-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; margin-bottom: 20px; }
    .card { padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; }
    .export-grid { display: flex; flex-direction: column; gap: 24px; }
    .export-section-title { margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #334155; }
    .export-buttons { display: flex; flex-wrap: wrap; gap: 10px; }
    .export-buttons button { display: inline-flex; align-items: center; gap: 6px; }
    .export-all { padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .export-all button { display: inline-flex; align-items: center; gap: 8px; }
  `]
})
export class AdminExportComponent {
  private exportSvc = inject(AdminExportService);

  isExporting = signal(false);

  async runExport(type: 'visions' | 'strategies' | 'valueChain' | 'ksf' | 'objectives' | 'keyResults' | 'tasks' | 'all'): Promise<void> {
    this.isExporting.set(true);
    try {
      switch (type) {
        case 'visions':
          await this.exportSvc.exportVisions();
          break;
        case 'strategies':
          await this.exportSvc.exportStrategies();
          break;
        case 'valueChain':
          await this.exportSvc.exportValueChainActivities();
          break;
        case 'ksf':
          await this.exportSvc.exportKsfs();
          break;
        case 'objectives':
          await this.exportSvc.exportObjectives();
          break;
        case 'keyResults':
          await this.exportSvc.exportKeyResults();
          break;
        case 'tasks':
          await this.exportSvc.exportTasks();
          break;
        case 'all':
          await this.exportSvc.exportAll();
          break;
      }
    } finally {
      this.isExporting.set(false);
    }
  }
}
