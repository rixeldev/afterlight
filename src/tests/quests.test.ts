import { advanceQuest, createQuestSave, isStepComplete, trackedStep } from '../game/quests/questSystem';
import { QUEST_STEPS } from '../data/quests';

describe('quest system', () => {
  it('starts on the wake step', () => {
    const quest = createQuestSave();
    expect(quest.activeStep).toBe('wake');
    expect(trackedStep(quest)?.id).toBe('wake');
  });

  it('advances quests from gameplay events', () => {
    let quest = createQuestSave();
    const result = advanceQuest(quest, 'travel', undefined, 18);
    quest = result.quest;
    expect(result.completedSteps.map((s) => s.id)).toEqual(['wake']);
    expect(quest.activeStep).toBe('gather');
    expect(quest.completed).toContain('wake');
  });

  it('does not award progress to the wrong objective', () => {
    let quest = advanceQuest(createQuestSave(), 'travel', undefined, 18).quest;
    const before = quest.progress['gather:wood'] ?? 0;
    quest = advanceQuest(quest, 'collect', 'wood_log', 3).quest;
    expect(quest.progress['gather:wood']).toBe(3);
    expect(before).toBe(0);
  });

  it('caps objective progress at the required amount', () => {
    let quest = advanceQuest(createQuestSave(), 'travel', undefined, 50).quest;
    quest = advanceQuest(quest, 'collect', 'wood_log', 20).quest;
    expect(quest.progress['gather:wood']).toBe(6);
  });

  it('completes a multi-objective step only when every objective is met', () => {
    let quest = advanceQuest(createQuestSave(), 'travel', undefined, 18).quest;
    quest = advanceQuest(quest, 'collect', 'wood_log', 6).quest;
    quest = advanceQuest(quest, 'collect', 'stone_chunk', 4).quest;
    const step = QUEST_STEPS.find((s) => s.id === 'gather')!;
    expect(isStepComplete(quest, step)).toBe(false);
    quest = advanceQuest(quest, 'collect', 'plant_fiber', 2).quest;
    expect(isStepComplete(quest, step)).toBe(true);
    expect(quest.activeStep).toBe('first_tool');
  });

  it('ignores events from an already completed step', () => {
    let quest = advanceQuest(createQuestSave(), 'travel', undefined, 18).quest;
    const result = advanceQuest(quest, 'travel', undefined, 100);
    quest = result.quest;
    expect(result.completedSteps).toHaveLength(0);
    expect(quest.progress['gather:wood']).toBeUndefined();
  });

  it('completes the full chapter in order', () => {
    let quest = createQuestSave();
    quest = advanceQuest(quest, 'travel', undefined, 18).quest;
    quest = advanceQuest(quest, 'collect', 'wood_log', 6).quest;
    quest = advanceQuest(quest, 'collect', 'stone_chunk', 4).quest;
    quest = advanceQuest(quest, 'collect', 'plant_fiber', 2).quest;
    quest = advanceQuest(quest, 'craft', 'stone_axe', 1).quest;
    quest = advanceQuest(quest, 'build', 'campfire', 1).quest;
    quest = advanceQuest(quest, 'build', 'simple_shelter', 1).quest;
    quest = advanceQuest(quest, 'discover', 'ranger_camp', 1).quest;
    quest = advanceQuest(quest, 'recover', 'damaged_recorder', 1).quest;
    expect(quest.activeStep).toBe('return_home');
    const final = advanceQuest(quest, 'return_home', undefined, 1);
    expect(final.quest.completed).toHaveLength(7);
    expect(final.activeStep).toBeNull();
  });
});
