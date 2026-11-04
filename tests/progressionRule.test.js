import { describe, expect, it } from 'vitest';

import { CATALOG_ENUM_VALUES } from '../src/constants/catalogEnums.js';
import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import { mapExerciseDetail } from '../src/repositories/exerciseMappers.js';
import { assertProgressionRuleAgrees } from '../src/validation/catalogFixtures.js';

const rule = (overrides) => ({
  model: 'double',
  loadStepKg: 2,
  loadStepLb: 5,
  durationStepSeconds: null,
  distanceStepMeters: null,
  stallSessions: 3,
  resetPercent: 10,
  note: null,
  ...overrides
});
const check = (overrides) => () =>
  assertProgressionRuleAgrees({ slug: 'x', progressionRule: rule(overrides) });

describe('progressionRule shape', () => {
  it('accepts each model with exactly the steps it uses', () => {
    expect(check({})).not.toThrow();
    expect(check({ model: 'load_then_reps' })).not.toThrow();
    expect(
      check({
        model: 'reps',
        loadStepKg: null,
        loadStepLb: null,
        resetPercent: null
      })
    ).not.toThrow();
    expect(
      check({
        model: 'duration',
        loadStepKg: null,
        loadStepLb: null,
        resetPercent: null,
        durationStepSeconds: 10
      })
    ).not.toThrow();
    expect(
      check({
        model: 'none',
        loadStepKg: null,
        loadStepLb: null,
        resetPercent: null,
        stallSessions: null
      })
    ).not.toThrow();
  });

  it('rejects missing or extra steps for the model', () => {
    expect(check({ loadStepLb: null })).toThrow(/loadStepLb must be set/);
    expect(check({ model: 'reps' })).toThrow(
      /loadStepKg must be null for reps/
    );
    expect(check({ durationStepSeconds: 10 })).toThrow(
      /durationStepSeconds must be null/
    );
    expect(
      check({
        model: 'distance',
        loadStepKg: null,
        loadStepLb: null,
        resetPercent: null
      })
    ).toThrow(/distanceStepMeters must be set/);
  });

  it('ties resetPercent to load and stallSessions to a real model', () => {
    expect(check({ resetPercent: null })).toThrow(/resetPercent/);
    expect(
      check({
        model: 'none',
        loadStepKg: null,
        loadStepLb: null,
        resetPercent: null
      })
    ).toThrow(/stallSessions/);
  });

  it('publishes the models under enums.progressionModels', () => {
    expect(CATALOG_ENUM_VALUES.progressionModels).toEqual([
      'load_then_reps',
      'double',
      'reps',
      'duration',
      'distance',
      'none'
    ]);
  });

  it('maps progression_rule onto the detail record', () => {
    const progressionRule = rule({});

    expect(
      mapExerciseDetail({ progression_rule: progressionRule }).progressionRule
    ).toEqual(progressionRule);
    expect(mapExerciseDetail({}).progressionRule).toBeNull();
  });
});

describe('catalog progression rules', () => {
  it('give every record a valid rule', async () => {
    const { exercises } = await loadCatalogFixtures();

    for (const exercise of exercises) {
      expect(() => assertProgressionRuleAgrees(exercise)).not.toThrow();
    }
  });

  // The ten samples the app approved in FitTrackV2 docs/EXERCISES-API-SYNC.md
  // (request 1), with resetPercent null where nothing is loaded.
  it('keep the values agreed with the app', async () => {
    const { exercises } = await loadCatalogFixtures();
    const bySlug = new Map(exercises.map((item) => [item.slug, item]));
    const agreed = {
      'barbell-back-squat': ['load_then_reps', 5, 10, null, 10],
      'dumbbell-bench-press': ['double', 2, 5, null, 10],
      'chest-press-machine': ['double', 5, 10, null, 10],
      'cable-row': ['double', 5, 10, null, 10],
      'dumbbell-lateral-raise': ['double', 1, 2.5, null, 10],
      'pull-up': ['reps', null, null, null, null],
      'push-up': ['reps', null, null, null, null],
      plank: ['duration', null, null, 10, null],
      'farmers-walk': ['load_then_reps', 2, 5, null, 10],
      'rowing-erg': ['none', null, null, null, null],
      'weighted-pull-up': ['load_then_reps', 2.5, 5, null, 10]
    };

    for (const [slug, values] of Object.entries(agreed)) {
      const r = bySlug.get(slug).progressionRule;

      expect({
        slug,
        values: [
          r.model,
          r.loadStepKg,
          r.loadStepLb,
          r.durationStepSeconds,
          r.resetPercent
        ]
      }).toEqual({ slug, values });
    }
  });
});
