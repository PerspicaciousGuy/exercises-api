import { describe, expect, it } from 'vitest';

import { CATALOG_ENUM_VALUES } from '../src/constants/catalogEnums.js';
import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import { buildExerciseImportPlan } from '../src/import/catalogImportPlans.js';
import { mapExerciseDetail } from '../src/repositories/exerciseMappers.js';
import {
  assertJointStressAgrees,
  parseCatalogFixtures
} from '../src/validation/catalogFixtures.js';

const REGIONS = [
  'neck',
  'shoulder',
  'elbow',
  'wrist',
  'spine',
  'hip',
  'knee',
  'ankle'
];
const LEVELS = CATALOG_ENUM_VALUES.jointStressLevels;

const stress = (overrides) => ({
  ...Object.fromEntries(REGIONS.map((region) => [region, 'none'])),
  ...overrides
});
const check = (record) => () =>
  assertJointStressAgrees({
    slug: 'x',
    jointRegionSlugs: [],
    gentlerSwapSlugs: {},
    ...record
  });

describe('jointStress shape', () => {
  it('lists the four levels under enums.jointStressLevels', () => {
    expect(LEVELS).toEqual(['none', 'low', 'moderate', 'high']);
  });

  it('ties jointRegionSlugs to the ratings', () => {
    expect(check({ jointStress: stress({ knee: 'low' }) })).not.toThrow();
    expect(
      check({
        jointStress: stress({ knee: 'low' }),
        jointRegionSlugs: ['knee']
      })
    ).not.toThrow();
    expect(
      check({ jointStress: stress({}), jointRegionSlugs: ['knee'] })
    ).toThrow(/knee is rated none but listed/);
    expect(check({ jointStress: stress({ knee: 'moderate' }) })).toThrow(
      /knee is rated moderate but not in jointRegionSlugs/
    );
  });

  it('wants swaps for exactly the high regions', () => {
    const high = {
      jointStress: stress({ knee: 'high' }),
      jointRegionSlugs: ['knee']
    };

    expect(check({ ...high, gentlerSwapSlugs: { knee: ['a'] } })).not.toThrow();
    expect(check(high)).toThrow(/gentlerSwapSlugs needs a key/);
    expect(
      check({ ...high, gentlerSwapSlugs: { knee: ['a'], hip: ['b'] } })
    ).toThrow(/gentlerSwapSlugs needs a key/);
  });

  it('maps joint_stress and gentler_swaps onto the detail record', () => {
    const swaps = { knee: [{ id: 'id-1', slug: 'a' }] };
    const detail = mapExerciseDetail({
      joint_stress: stress({ knee: 'high' }),
      gentler_swaps: swaps
    });

    expect(detail.jointStress.knee).toBe('high');
    expect(detail.gentlerSwaps).toEqual(swaps);
    expect(mapExerciseDetail({}).jointStress).toBeNull();
    expect(mapExerciseDetail({}).gentlerSwaps).toBeNull();
  });

  it('resolves swap slugs to {id, slug} when planning the import', () => {
    const [row] = buildExerciseImportPlan({
      exercises: [
        {
          slug: 'a',
          jointStress: stress({ knee: 'high' }),
          gentlerSwapSlugs: { knee: ['b'] },
          aliases: [],
          primaryMuscleSlugs: [],
          secondaryMuscleSlugs: [],
          stabilizerMuscleSlugs: [],
          equipmentSlugs: [],
          optionalEquipmentSlugs: [],
          variationSlugs: [],
          progressionSlugs: [],
          regressionSlugs: [],
          media: []
        }
      ],
      lookups: {
        exerciseIdsBySlug: new Map([
          ['a', 'id-a'],
          ['b', 'id-b']
        ]),
        categoryIdsBySlug: new Map([[undefined, 1]])
      }
    }).exercises;

    expect(row.joint_stress.knee).toBe('high');
    expect(row.gentler_swaps).toEqual({ knee: [{ id: 'id-b', slug: 'b' }] });
  });
});

describe('catalog joint stress', () => {
  it('rates every region on every record, with real swaps that are gentler', async () => {
    const { references, exercises } = await loadCatalogFixtures();
    const regions = references.jointRegions.map((item) => item.slug);

    expect(regions.sort()).toEqual([...REGIONS].sort());
    expect(() => parseCatalogFixtures({ references, exercises })).not.toThrow();
    for (const exercise of exercises) {
      expect(Object.keys(exercise.jointStress).sort()).toEqual(
        [...REGIONS].sort()
      );
    }
  });

  it('rejects a swap that is not gentler than the exercise it replaces', async () => {
    const { references, exercises } = await loadCatalogFixtures();
    const squat = structuredClone(
      exercises.find((item) => item.slug === 'barbell-back-squat')
    );

    squat.gentlerSwapSlugs.knee = ['leg-extension'];

    expect(() =>
      parseCatalogFixtures({
        references,
        exercises: exercises.map((item) =>
          item.slug === squat.slug ? squat : item
        )
      })
    ).toThrow(/knee swap "leg-extension" \(high\) is not gentler than high/);
  });

  // The ten samples the app approved in FitTrackV2 docs/EXERCISES-API-SYNC.md
  // (request 5), in the order neck, shoulder, elbow, wrist, spine, hip, knee,
  // ankle. - none, l low, m moderate, h high.
  it('keeps the ratings and swaps agreed with the app', async () => {
    const { exercises } = await loadCatalogFixtures();
    const bySlug = new Map(exercises.map((item) => [item.slug, item]));
    const letter = { none: '-', low: 'l', moderate: 'm', high: 'h' };
    const agreed = {
      'barbell-back-squat': [
        'lmllhmhm',
        {
          knee: ['barbell-box-squat', 'barbell-hip-thrust'],
          spine: ['belt-squat', 'leg-press']
        }
      ],
      'barbell-deadlift': [
        '-lllhhml',
        {
          spine: ['trap-bar-deadlift', 'cable-pull-through'],
          hip: ['rack-pull', 'cable-pull-through']
        }
      ],
      'barbell-bench-press': [
        '-hmmll--',
        { shoulder: ['dumbbell-bench-press', 'chest-press-machine'] }
      ],
      'barbell-overhead-press': ['lhmmmlll', { shoulder: ['landmine-press'] }],
      dip: [
        '-hmml---',
        { shoulder: ['close-grip-bench-press', 'triceps-pushdown'] }
      ],
      'forward-lunge': ['----lmhm', { knee: ['reverse-lunge', 'split-squat'] }],
      'leg-extension': ['-----lh-', { knee: ['wall-sit', 'box-squat'] }],
      'push-up': [
        '-mmhll--',
        { wrist: ['chest-press-machine', 'dumbbell-bench-press'] }
      ],
      plank: ['lml-ml--', {}],
      'romanian-deadlift': [
        '-lllhml-',
        { spine: ['cable-pull-through', 'seated-leg-curl'] }
      ]
    };

    for (const [slug, [code, swaps]] of Object.entries(agreed)) {
      const exercise = bySlug.get(slug);

      expect({
        slug,
        code: REGIONS.map(
          (region) => letter[exercise.jointStress[region]]
        ).join(''),
        swaps: exercise.gentlerSwapSlugs
      }).toEqual({ slug, code, swaps });
    }
  });
});
