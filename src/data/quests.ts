import type { QuestStepDef } from '../game/types';

/**
 * Chapter 1 — "The Signal".
 * Objective counters are derived from gameplay events and stored per objective,
 * so quest state survives save/load without scene references.
 */
export const QUEST_STEPS: QuestStepDef[] = [
  {
    id: 'wake',
    titleKey: 'quest.wake.title',
    summaryKey: 'quest.wake.summary',
    hintKey: 'quest.wake.hint',
    objectives: [{ id: 'walk', kind: 'travel', amount: 18, textKey: 'quest.wake.obj_walk' }],
    rewardXp: 40,
  },
  {
    id: 'gather',
    titleKey: 'quest.gather.title',
    summaryKey: 'quest.gather.summary',
    hintKey: 'quest.gather.hint',
    objectives: [
      { id: 'wood', kind: 'collect', target: 'wood_log', amount: 6, textKey: 'quest.gather.obj_wood' },
      { id: 'stone', kind: 'collect', target: 'stone_chunk', amount: 4, textKey: 'quest.gather.obj_stone' },
      { id: 'fiber', kind: 'collect', target: 'plant_fiber', amount: 2, textKey: 'quest.gather.obj_fiber' },
    ],
    rewardXp: 80,
    rewardItems: { wild_berries: 3 },
  },
  {
    id: 'first_tool',
    titleKey: 'quest.first_tool.title',
    summaryKey: 'quest.first_tool.summary',
    hintKey: 'quest.first_tool.hint',
    objectives: [{ id: 'craft_axe', kind: 'craft', target: 'stone_axe', amount: 1, textKey: 'quest.first_tool.obj_axe' }],
    rewardXp: 120,
    grantsFlags: ['tool_crafted'],
  },
  {
    id: 'homestead',
    titleKey: 'quest.homestead.title',
    summaryKey: 'quest.homestead.summary',
    hintKey: 'quest.homestead.hint',
    objectives: [
      { id: 'fire', kind: 'build', target: 'campfire', amount: 1, textKey: 'quest.homestead.obj_fire' },
      { id: 'shelter', kind: 'build', target: 'simple_shelter', amount: 1, textKey: 'quest.homestead.obj_shelter' },
    ],
    rewardXp: 160,
    grantsFlags: ['homestead_established', 'nightfall'],
  },
  {
    id: 'signal',
    titleKey: 'quest.signal.title',
    summaryKey: 'quest.signal.summary',
    hintKey: 'quest.signal.hint',
    objectives: [{ id: 'camp', kind: 'discover', target: 'ranger_camp', amount: 1, textKey: 'quest.signal.obj_camp' }],
    rewardXp: 180,
  },
  {
    id: 'recording',
    titleKey: 'quest.recording.title',
    summaryKey: 'quest.recording.summary',
    hintKey: 'quest.recording.hint',
    objectives: [
      { id: 'recover', kind: 'recover', target: 'damaged_recorder', amount: 1, textKey: 'quest.recording.obj_recorder' },
    ],
    rewardXp: 220,
    grantsFlags: ['recording_recovered'],
  },
  {
    id: 'return_home',
    titleKey: 'quest.return_home.title',
    summaryKey: 'quest.return_home.summary',
    hintKey: 'quest.return_home.hint',
    objectives: [
      { id: 'home', kind: 'return_home', amount: 1, textKey: 'quest.return_home.obj_home' },
    ],
    rewardXp: 300,
    grantsFlags: ['chapter1_complete'],
  },
];

export function questStep(id: string): QuestStepDef | undefined {
  return QUEST_STEPS.find((s) => s.id === id);
}

export function nextQuestStep(id: string | null): QuestStepDef | undefined {
  if (!id) return QUEST_STEPS[0];
  const index = QUEST_STEPS.findIndex((s) => s.id === id);
  if (index < 0) return undefined;
  return QUEST_STEPS[index + 1];
}

export { STORY } from './world';
