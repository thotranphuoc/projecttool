import { Injectable, inject, signal, computed } from '@angular/core';
import { ObjectiveService } from './objective.service';
import { BigPictureObjective, BigPictureKR } from '../shared/models';

/** Extended KR for UI: adds computed krScore (metric vs task-driven) */
export interface BigPictureKRWithScore extends BigPictureKR {
  /** Computed: metric = (current/target)*100 capped 100; task_linked = progress_percent from DB */
  krScore: number;
}

/** Objective with key_results enriched by krScore */
export interface BigPictureObjectiveWithScores extends Omit<BigPictureObjective, 'key_results'> {
  key_results: BigPictureKRWithScore[];
}

/** Per-project progress (average of objectives' progress_percent); key __company__ for company-wide */
export type ProjectProgressMap = Map<string, number>;

@Injectable({ providedIn: 'root' })
export class StrategyService {
  private objectiveSvc = inject(ObjectiveService);

  /** Raw big picture from DB (get_big_picture RPC). Source of truth from triggers. */
  readonly bigPictureObjectives = signal<BigPictureObjective[]>([]);
  readonly isLoading = signal(false);

  /** Computed: same tree with krScore on each KR for UI. DB progress_percent kept; krScore = metric score or progress. */
  readonly bigPictureWithScores = computed<BigPictureObjectiveWithScores[]>(() => {
    const list = this.bigPictureObjectives();
    return list.map(obj => ({
      ...obj,
      key_results: (obj.key_results ?? []).map(kr => ({
        ...kr,
        krScore: this.computeKrScore(kr),
      })),
    }));
  });

  /** Per-project progress: average of objectives.progress_percent. Key __company__ for project_id null. */
  readonly projectProgressMap = computed<ProjectProgressMap>(() => {
    const list = this.bigPictureObjectives();
    const byProject = new Map<string, number[]>();
    for (const o of list) {
      const key = o.project_id ?? '__company__';
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(o.progress_percent);
    }
    const out = new Map<string, number>();
    for (const [key, arr] of byProject) {
      const sum = arr.reduce((a, b) => a + b, 0);
      out.set(key, arr.length ? sum / arr.length : 0);
    }
    return out;
  });

  /** Task-driven progress for a KR: from DB (trigger roll-up). Exposed for UI as "task progress". */
  getTaskProgressForKr(kr: BigPictureKR): number {
    return kr.progress_percent ?? 0;
  }

  async loadBigPicture(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.objectiveSvc.getBigPicture();
      this.bigPictureObjectives.set(data);
    } finally {
      this.isLoading.set(false);
    }
  }

  private computeKrScore(kr: BigPictureKR): number {
    if (kr.type === 'metric' && kr.target_value != null && Number(kr.target_value) !== 0) {
      const current = Number(kr.current_value) ?? 0;
      const target = Number(kr.target_value);
      const pct = (current / target) * 100;
      return Math.min(100, Math.max(0, pct));
    }
    return kr.progress_percent ?? 0;
  }
}
