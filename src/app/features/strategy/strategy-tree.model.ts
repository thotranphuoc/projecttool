import type { BigPictureObjectiveWithScores } from '../../services/strategy.service';
import type { BigPictureTask } from '../../shared/models';

/** Node type for 9-level strategy tree: Vision → KSF → Strategy → Value Chain → Objective → KR → Project → Task → SubTask */
export type StrategyTreeNodeType =
  | 'vision'
  | 'ksf'
  | 'strategy'
  | 'value_chain'
  | 'objective'
  | 'kr'
  | 'project'
  | 'task'
  | 'subtask';

export interface StrategyTreeNode {
  type: StrategyTreeNodeType;
  label: string;
  id?: string;
  children: StrategyTreeNode[];
  progressPercent?: number;
  objective?: BigPictureObjectiveWithScores;
  kr?: { id: string; title: string; krScore: number; type: string };
  task?: BigPictureTask;
  projectId?: string;
  projectName?: string;
  /** When type === 'subtask' */
  subtask?: { id: string; title: string; status: string };
}

export function hasStrategyTreeChildren(node: StrategyTreeNode): boolean {
  return node.children != null && node.children.length > 0;
}
