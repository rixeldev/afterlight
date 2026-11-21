import type { ObjectiveDef, QuestSave, QuestStepDef } from '../types';
import { nextQuestStep, QUEST_STEPS, questStep } from '../../data/quests';

export function progressKey(stepId: string, objectiveId: string): string {
  return `${stepId}:${objectiveId}`;
}

export function createQuestSave(): QuestSave {
  return { activeStep: QUEST_STEPS[0]?.id ?? null, completed: [], progress: {} };
}

export function objectiveProgress(quest: QuestSave, step: QuestStepDef, objective: ObjectiveDef): number {
  const raw = quest.progress[progressKey(step.id, objective.id)] ?? 0;
  return Math.min(raw, objective.amount ?? 1);
}

export function isObjectiveComplete(quest: QuestSave, step: QuestStepDef, objective: ObjectiveDef): boolean {
  return objectiveProgress(quest, step, objective) >= (objective.amount ?? 1);
}

export function isStepComplete(quest: QuestSave, step: QuestStepDef): boolean {
  return step.objectives.every((o) => isObjectiveComplete(quest, step, o));
}

export interface QuestUpdate {
  quest: QuestSave;
  /** Steps completed by this update (for rewards/UI). */
  completedSteps: QuestStepDef[];
  activeStep: QuestStepDef | null;
}

/**
 * Adds progress to matching objectives of the active step only.
 * `kind` and optional `target` select which objective receives the units.
 */
export function advanceQuest(
  quest: QuestSave,
  kind: ObjectiveDef['kind'],
  target: string | undefined,
  amount: number,
  absolute = false,
): QuestUpdate {
  const state: QuestSave = {
    ...quest,
    completed: [...quest.completed],
    progress: { ...quest.progress },
  };
  let step = quest.activeStep ? questStep(quest.activeStep) ?? null : null;
  const completedSteps: QuestStepDef[] = [];

  if (!step) return { quest: state, completedSteps, activeStep: null };

  const apply = (current: QuestStepDef) => {
    for (const objective of current.objectives) {
      if (objective.kind !== kind) continue;
      if (objective.target && target && objective.target !== target) continue;
      if (objective.target && !target) continue;
      const key = progressKey(current.id, objective.id);
      const cap = objective.amount ?? 1;
      const prev = state.progress[key] ?? 0;
      state.progress[key] = absolute ? Math.min(cap, Math.max(prev, amount)) : Math.min(cap, prev + amount);
    }
  };

  apply(step);

  // A single event may complete the step and immediately feed the next one
  // (for example, returning home finishes the chapter).
  let guard = 0;
  while (step && isStepComplete(state, step) && guard < QUEST_STEPS.length) {
    completedSteps.push(step);
    if (!state.completed.includes(step.id)) state.completed.push(step.id);
    const following: QuestStepDef | null = nextQuestStep(step.id) ?? null;
    state.activeStep = following?.id ?? null;
    step = following;
    guard += 1;
  }

  return { quest: state, completedSteps, activeStep: state.activeStep ? questStep(state.activeStep) ?? null : null };
}

export function chapterProgress(quest: QuestSave): number {
  const completed = quest.completed.length;
  return completed / QUEST_STEPS.length;
}

export function trackedStep(quest: QuestSave): QuestStepDef | null {
  if (!quest.activeStep) return null;
  return questStep(quest.activeStep) ?? null;
}

export function allSteps(): QuestStepDef[] {
  return QUEST_STEPS;
}
