import { describe, expect, it } from 'vitest';

import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import {
  parseCatalogFixtures,
  parseExerciseFixtures,
  parseReferenceFixtures
} from '../src/validation/catalogFixtures.js';

describe('catalog fixture validation', () => {
  it('accepts the checked-in Phase 2 fixture dataset', async () => {
    const fixtures = await loadCatalogFixtures();

    expect(fixtures.references.muscles.length).toBeGreaterThanOrEqual(10);
    expect(fixtures.references.equipment.length).toBeGreaterThanOrEqual(8);
    expect(fixtures.exercises).toHaveLength(12);
  });

  it('accepts the Phase 2 reference fixtures', () => {
    const fixtures = parseReferenceFixtures({
      muscles: [
        {
          name: 'Chest',
          slug: 'chest',
          region: 'upper_body',
          muscleGroup: 'push',
          displayOrder: 10
        }
      ],
      equipment: [
        {
          name: 'Bodyweight',
          slug: 'bodyweight',
          equipmentGroup: 'bodyweight',
          displayOrder: 10
        }
      ],
      categories: [
        {
          name: 'Strength',
          slug: 'strength',
          category: 'strength',
          description: 'Resistance training movements.',
          displayOrder: 10
        }
      ],
      exerciseFlags: [
        {
          name: 'Beginner Friendly',
          slug: 'beginner-friendly',
          description: 'Suitable for most beginners.',
          displayOrder: 10
        }
      ],
      jointRegions: [
        {
          name: 'Shoulder',
          slug: 'shoulder',
          regionGroup: 'upper_body',
          displayOrder: 10
        }
      ]
    });

    expect(fixtures.muscles).toHaveLength(1);
    expect(fixtures.equipment[0].slug).toBe('bodyweight');
  });

  it('generates missing slugs from names', () => {
    const references = parseReferenceFixtures({
      muscles: [
        {
          name: 'Lower Back',
          region: 'core',
          muscleGroup: 'posterior_core'
        }
      ],
      equipment: [],
      categories: [],
      exerciseFlags: [],
      jointRegions: []
    });
    const exercises = parseExerciseFixtures([
      {
        name: 'Bodyweight Squat',
        status: 'active',
        description: 'A basic squat pattern.',
        instructions: ['Stand tall.'],
        tips: [],
        contraindications: [],
        categorySlug: 'strength',
        difficulty: 'beginner',
        movementPattern: 'squat',
        mechanics: 'compound',
        jointRegionSlugs: [],
        flagSlugs: [],
        programming: {},
        tags: [],
        aliases: [],
        primaryMuscleSlugs: ['quadriceps'],
        secondaryMuscleSlugs: [],
        stabilizerMuscleSlugs: [],
        equipmentSlugs: [],
        variationSlugs: [],
        progressionSlugs: [],
        regressionSlugs: [],
        media: []
      }
    ]);

    expect(references.muscles[0].slug).toBe('lower-back');
    expect(exercises[0].slug).toBe('bodyweight-squat');
  });

  it('rejects references with invalid slugs', () => {
    expect(() =>
      parseReferenceFixtures({
        muscles: [
          {
            name: 'Bad Muscle',
            slug: 'Bad Slug',
            region: 'upper_body',
            muscleGroup: 'push'
          }
        ],
        equipment: [],
        categories: [],
        exerciseFlags: [],
        jointRegions: []
      })
    ).toThrow(/Invalid reference fixtures/);
  });

  it('accepts exercises with optional empty media', () => {
    const exercises = parseExerciseFixtures([
      {
        name: 'Push-up',
        slug: 'push-up',
        status: 'active',
        description: 'A bodyweight upper-body pushing exercise.',
        instructions: ['Start in a high plank.', 'Lower under control.'],
        tips: ['Keep the ribs down.'],
        contraindications: [],
        categorySlug: 'strength',
        difficulty: 'beginner',
        movementPattern: 'push',
        forceType: 'push',
        mechanics: 'compound',
        position: 'other',
        planeOfMotion: 'sagittal',
        jointRegionSlugs: ['shoulder', 'elbow'],
        laterality: 'bilateral',
        loadType: 'bodyweight',
        skillType: 'strength',
        flagSlugs: ['beginner-friendly'],
        programming: {
          defaultSets: 3,
          defaultReps: '8-15'
        },
        tags: ['bodyweight', 'push'],
        isPremium: false,
        catalogVersion: 1,
        aliases: ['Press-up'],
        primaryMuscleSlugs: ['chest'],
        secondaryMuscleSlugs: ['triceps'],
        stabilizerMuscleSlugs: ['abs'],
        equipmentSlugs: ['bodyweight'],
        variationSlugs: [],
        progressionSlugs: [],
        regressionSlugs: [],
        media: []
      }
    ]);

    expect(exercises[0].media).toEqual([]);
  });

  it('rejects exercises that reference missing fixture slugs', () => {
    expect(() =>
      parseCatalogFixtures({
        references: {
          muscles: [],
          equipment: [],
          categories: [],
          exerciseFlags: [],
          jointRegions: []
        },
        exercises: [
          {
            name: 'Push-up',
            slug: 'push-up',
            status: 'active',
            description: 'A bodyweight upper-body pushing exercise.',
            instructions: ['Start in a high plank.'],
            tips: [],
            contraindications: [],
            categorySlug: 'strength',
            difficulty: 'beginner',
            movementPattern: 'push',
            mechanics: 'compound',
            jointRegionSlugs: [],
            flagSlugs: [],
            programming: {},
            tags: [],
            aliases: [],
            primaryMuscleSlugs: ['chest'],
            secondaryMuscleSlugs: [],
            stabilizerMuscleSlugs: [],
            equipmentSlugs: [],
            variationSlugs: [],
            progressionSlugs: [],
            regressionSlugs: [],
            media: []
          }
        ]
      })
    ).toThrow(/unknown category slug "strength"/);
  });
});
