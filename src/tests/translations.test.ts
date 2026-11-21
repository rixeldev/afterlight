import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { ITEMS } from '../data/items';
import { RECIPES, STRUCTURES } from '../data/recipes';
import { POIS, STORY } from '../data/world';
import { QUEST_STEPS } from '../data/quests';
import { SKILL_META } from '../game/progression/progression';

const ROOT = join(__dirname, '..');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(path) && !path.includes('/tests/')) files.push(path);
  }
  return files;
}

function missing(key: string): boolean {
  return !(key in en);
}

describe('translation coverage', () => {
  it('has every literal key used with t(...) in the UI', () => {
    const used = new Set<string>();
    const pattern = /\bt\(\s*'([^']+)'/g;
    for (const file of walk(join(ROOT, 'ui')).concat(walk(join(ROOT, 'game')), walk(ROOT))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(pattern)) {
        if (match[1]) used.add(match[1]);
      }
    }
    const gaps = [...used].filter(missing).sort();
    expect(gaps).toEqual([]);
  });

  it('has every dynamic content key', () => {
    const keys: string[] = [];
    for (const item of Object.values(ITEMS)) {
      keys.push(item.nameKey, item.descKey);
    }
    for (const recipe of Object.values(RECIPES)) {
      keys.push(recipe.nameKey, recipe.descKey);
    }
    for (const structure of Object.values(STRUCTURES)) {
      keys.push(structure.nameKey, structure.descKey);
      keys.push(`structure.${structure.id}.name`);
    }
    for (const poi of POIS) keys.push(poi.nameKey, poi.descKey);
    for (const entry of STORY) keys.push(entry.titleKey, entry.bodyKey);
    for (const step of QUEST_STEPS) {
      keys.push(step.titleKey, step.summaryKey);
      if (step.hintKey) keys.push(step.hintKey);
      for (const objective of step.objectives) keys.push(objective.textKey);
    }
    for (const skill of SKILL_META) keys.push(skill.nameKey, skill.descKey);
    for (const station of ['handcraft', 'campfire', 'workbench']) {
      keys.push(`station.${station}`, `craft.station.${station}`, `craft.station_short.${station}`);
    }
    for (const kind of ['material', 'food', 'tool', 'consumable', 'quest']) {
      keys.push(`inv.category.${kind}`);
    }
    for (const kind of ['audio_log', 'note', 'chapter']) keys.push(`story.kind.${kind}`);
    for (const filter of ['all', 'tools', 'survival', 'building']) keys.push(`craft.filter.${filter}`);
    for (const reason of ['ok', 'outside_plot', 'water', 'slope', 'overlap', 'obstructed', 'unique', 'unknown']) {
      keys.push(`build.invalid.${reason}`);
    }
    for (const language of ['auto', 'en', 'es']) keys.push(`settings.language.${language}`);
    for (const quality of ['low', 'medium', 'high']) keys.push(`settings.graphics.${quality}`);

    const gaps = [...new Set(keys)].filter(missing).sort();
    expect(gaps).toEqual([]);
  });

  it('has the same dynamic keys in Spanish', () => {
    const dynamic = Object.values(ITEMS)
      .flatMap((i) => [i.nameKey, i.descKey])
      .concat(Object.values(RECIPES).flatMap((r) => [r.nameKey, r.descKey]))
      .concat(Object.values(STRUCTURES).flatMap((s) => [s.nameKey, s.descKey]))
      .concat(POIS.flatMap((p) => [p.nameKey, p.descKey]))
      .concat(STORY.flatMap((s) => [s.titleKey, s.bodyKey]))
      .concat(QUEST_STEPS.flatMap((s) => [s.titleKey, s.summaryKey, ...(s.hintKey ? [s.hintKey] : [])]));
    const gaps = [...new Set(dynamic)].filter((key) => !(key in es));
    expect(gaps).toEqual([]);
  });
});
