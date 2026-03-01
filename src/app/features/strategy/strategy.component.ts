import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts';
import { ObjectiveService } from '../../services/objective.service';
import { ProjectService } from '../../services/project.service';
import { BSC_TYPES, ObjectiveType } from '../../shared/models';
import type { EChartsOption } from 'echarts';

@Component({
  selector: 'app-strategy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  template: `
    <div class="strategy-page">
      <div class="page-header">
        <h1 class="page-title">Strategy (BSC Radar)</h1>
        <mat-form-field appearance="outline" style="width:220px">
          <mat-label>Project</mat-label>
          <mat-select [(ngModel)]="selectedProject" (ngModelChange)="onProjectChange()">
            <mat-option [value]="null">Global</mat-option>
            @for (p of projectSvc.projects(); track p.id) {
              <mat-option [value]="p.id">{{ p.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="strategy-layout">
        <!-- Radar chart -->
        <div class="chart-card card p-4">
          <h3>BSC Radar</h3>
          <div echarts [options]="chartOptions()" class="radar-chart"></div>
        </div>

        <!-- BSC scores -->
        <div class="scores-panel">
          @for (bsc of bscTypes; track bsc.type) {
            <div class="score-card card p-4">
              <div class="score-header">
                <mat-icon>{{ bsc.icon }}</mat-icon>
                <span class="score-label">{{ bsc.label }}</span>
              </div>
              <div class="score-value">{{ getTypeScore(bsc.type) | number:'1.0-0' }}%</div>
              <div class="score-objectives">
                @for (obj of getObjectivesByType(bsc.type); track obj.id) {
                  <div class="obj-item">
                    <span class="text-sm">{{ obj.title }}</span>
                    <span class="text-xs font-semibold">{{ obj.progress_percent | number:'1.0-0' }}%</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .strategy-page { max-width: 1200px; margin: 0 auto; }
    .strategy-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
    .chart-card h3 { margin: 0 0 16px; font-weight: 700; }
    .radar-chart { height: 400px; }
    .scores-panel { display: flex; flex-direction: column; gap: 12px; }
    .score-card { padding: 16px !important; }
    .score-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #3b82f6; font-weight: 600; }
    .score-value { font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    .obj-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
    @media (max-width: 900px) { .strategy-layout { grid-template-columns: 1fr; } }
  `]
})
export class StrategyComponent implements OnInit {
  readonly objectiveSvc = inject(ObjectiveService);
  readonly projectSvc   = inject(ProjectService);

  bscTypes       = BSC_TYPES;
  selectedProject = signal<string | null>(null);

  ngOnInit(): void {
    this.projectSvc.loadProjects();
    this.objectiveSvc.loadObjectives(null);
  }

  onProjectChange(): void {
    this.objectiveSvc.loadObjectives(this.selectedProject());
  }

  getObjectivesByType(type: ObjectiveType) {
    return this.objectiveSvc.objectives().filter(o => o.type === type);
  }

  getTypeScore(type: ObjectiveType): number {
    const objs = this.getObjectivesByType(type);
    if (!objs.length) return 0;
    return objs.reduce((sum, o) => sum + o.progress_percent, 0) / objs.length;
  }

  readonly chartOptions = computed<EChartsOption>(() => {
    const scores = BSC_TYPES.map(b => Math.round(this.getTypeScore(b.type)));
    return {
      radar: {
        indicator: BSC_TYPES.map(b => ({ name: b.label, max: 100 })),
        radius: '65%',
        axisName: { color: '#475569', fontSize: 13, fontWeight: 600 }
      },
      series: [{
        type: 'radar',
        data: [{
          value: scores,
          name: 'BSC Score',
          areaStyle: { opacity: 0.2, color: '#3b82f6' },
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' }
        }],
        tooltip: { trigger: 'item' }
      }],
      tooltip: {},
      backgroundColor: 'transparent'
    };
  });
}
