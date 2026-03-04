import type { BigPictureObjectiveWithScores } from '../../services/strategy.service';
import type { BigPictureTask } from '../../shared/models';
import type { Subtask } from '../../shared/models';
import type { StrategyTreeNode } from './strategy-tree.model';

/**
 * Build 9-level strategy tree: Vision → KSF → Strategy → Value Chain → Objective → KR → Project → Task → SubTask.
 * Uses only data from get_big_picture (objectives with key_results and tasks). Subtasks loaded on demand via subtasksByTaskId.
 */
export function buildStrategyTree(
  objectives: BigPictureObjectiveWithScores[],
  subtasksByTaskId: Map<string, Subtask[]>,
  getProjectName?: (projectId: string) => string
): StrategyTreeNode[] {
  const roots: StrategyTreeNode[] = [];
  if (objectives.length === 0) return roots;

  // Group by vision_id
  const byVision = new Map<string, BigPictureObjectiveWithScores[]>();
  for (const o of objectives) {
    const vid = o.vision_id ?? '__no_vision__';
    if (!byVision.has(vid)) byVision.set(vid, []);
    byVision.get(vid)!.push(o);
  }

  const visionTitles = new Map<string, string>();
  for (const o of objectives) {
    const vid = o.vision_id ?? '__no_vision__';
    if (!visionTitles.has(vid)) visionTitles.set(vid, o.vision_title ?? 'Chưa gắn tầm nhìn');
  }

  for (const [visionId, visionObjs] of byVision) {
    const visionLabel = visionTitles.get(visionId) ?? 'Chưa gắn tầm nhìn';
    const ksfMap = new Map<string, BigPictureObjectiveWithScores[]>();
    for (const o of visionObjs) {
      const kid = o.ksf_id ?? '__no_ksf__';
      if (!ksfMap.has(kid)) ksfMap.set(kid, []);
      ksfMap.get(kid)!.push(o);
    }

    const ksfChildren: StrategyTreeNode[] = [];
    for (const [ksfId, ksfObjs] of ksfMap) {
      const ksfLabel = ksfObjs[0]?.ksf_label ?? 'Chưa gắn KSF';
      const strategyMap = new Map<string, BigPictureObjectiveWithScores[]>();
      for (const o of ksfObjs) {
        const sid = o.strategy_id ?? '__no_strategy__';
        if (!strategyMap.has(sid)) strategyMap.set(sid, []);
        strategyMap.get(sid)!.push(o);
      }

      const strategyChildren: StrategyTreeNode[] = [];
      for (const [, strategyObjs] of strategyMap) {
        const strategyLabel = strategyObjs[0]?.strategy_title ?? 'Chưa gắn chiến lược';
        const vcMap = new Map<string, BigPictureObjectiveWithScores[]>();
        for (const o of strategyObjs) {
          const vcid = o.value_chain_activity_id ?? '__no_vc__';
          if (!vcMap.has(vcid)) vcMap.set(vcid, []);
          vcMap.get(vcid)!.push(o);
        }

        const vcChildren: StrategyTreeNode[] = [];
        for (const [, vcObjs] of vcMap) {
          const vcLabel = vcObjs[0]?.value_chain_activity_label ?? 'Chưa gắn chuỗi giá trị';
          const objNodes: StrategyTreeNode[] = vcObjs.map(obj => {
            const krNodes: StrategyTreeNode[] = (obj.key_results ?? []).map(kr => {
              const tasks = kr.tasks ?? [];
              const byProject = new Map<string, BigPictureTask[]>();
              for (const t of tasks) {
                const pid = t.project_id ?? '__no_project__';
                if (!byProject.has(pid)) byProject.set(pid, []);
                byProject.get(pid)!.push(t);
              }
              const projectNodes: StrategyTreeNode[] = [];
              for (const [pid, projectTasks] of byProject) {
                const projectName = pid === '__no_project__' ? 'Không gắn dự án' : (getProjectName?.(pid) ?? `Dự án ${pid.slice(0, 8)}`);
                const taskNodes: StrategyTreeNode[] = projectTasks.map(t => {
                  const subs = subtasksByTaskId.get(t.id) ?? [];
                  const subtaskNodes: StrategyTreeNode[] = subs.map(s => ({
                    type: 'subtask' as const,
                    label: s.title,
                    id: s.id,
                    children: [],
                    subtask: { id: s.id, title: s.title, status: s.status },
                  }));
                  return {
                    type: 'task' as const,
                    label: t.title,
                    id: t.id,
                    children: subtaskNodes,
                    task: t,
                    projectId: pid === '__no_project__' ? undefined : pid,
                  };
                });
                projectNodes.push({
                  type: 'project',
                  label: projectName,
                  id: pid === '__no_project__' ? undefined : pid,
                  children: taskNodes,
                  projectId: pid === '__no_project__' ? undefined : pid,
                  projectName,
                });
              }
              return {
                type: 'kr',
                label: kr.title,
                id: kr.id,
                children: projectNodes,
                progressPercent: kr.krScore,
                kr: { id: kr.id, title: kr.title, krScore: kr.krScore, type: kr.type },
              };
            });
            return {
              type: 'objective',
              label: obj.title,
              id: obj.id,
              children: krNodes,
              progressPercent: obj.progress_percent,
              objective: obj,
            };
          });
          vcChildren.push({
            type: 'value_chain',
            label: vcLabel,
            id: vcObjs[0]?.value_chain_activity_id ?? undefined,
            children: objNodes,
          });
        }
        strategyChildren.push({
          type: 'strategy',
          label: strategyLabel,
          id: strategyObjs[0]?.strategy_id ?? undefined,
          children: vcChildren,
        });
      }
      ksfChildren.push({
        type: 'ksf',
        label: ksfLabel,
        id: ksfId === '__no_ksf__' ? undefined : ksfId,
        children: strategyChildren,
      });
    }
    roots.push({
      type: 'vision',
      label: visionLabel,
      id: visionId === '__no_vision__' ? undefined : visionId,
      children: ksfChildren,
    });
  }
  return roots;
}
