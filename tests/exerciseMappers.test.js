import { describe, expect, it } from 'vitest';

import {
  DETAIL_COLUMNS,
  mapExerciseDetail
} from '../src/repositories/exerciseMappers.js';

const baseRow = {
  id: 'exercise-1',
  slug: 'barbell-back-squat',
  name: 'Barbell Back Squat',
  status: 'active',
  difficulty: 'intermediate',
  movement_pattern: 'squat',
  tags: ['barbell'],
  updated_at: '2026-10-17T10:00:00.000Z',
  categories: { slug: 'strength', name: 'Strength' }
};

describe('mapExerciseDetail', () => {
  it('embeds muscles, equipment, aliases, relations and media in one select', () => {
    for (const embed of [
      'exercise_aliases(alias)',
      'exercise_primary_muscles(muscles(slug,display_order))',
      'exercise_equipment(equipment(slug,display_order))',
      'variations:exercise_variations!exercise_variations_exercise_id_fkey(exercises!exercise_variations_variation_id_fkey(id,slug,status))',
      'exercise_media('
    ]) {
      expect(DETAIL_COLUMNS).toContain(embed);
    }
  });

  it('maps the full record with stable ordering', () => {
    const exercise = mapExerciseDetail({
      ...baseRow,
      exercise_aliases: [{ alias: 'Back Squat' }, { alias: 'Barbell Squat' }],
      exercise_primary_muscles: [
        { muscles: { slug: 'glutes', display_order: 170 } },
        { muscles: { slug: 'quadriceps', display_order: 150 } }
      ],
      exercise_secondary_muscles: [
        { muscles: { slug: 'adductors', display_order: 180 } }
      ],
      exercise_stabilizer_muscles: [
        { muscles: { slug: 'lower-back', display_order: 140 } },
        { muscles: { slug: 'abs', display_order: 120 } }
      ],
      exercise_equipment: [
        { equipment: { slug: 'barbell', display_order: 20 } }
      ],
      variations: [
        {
          exercises: { id: 'v2', slug: 'smith-machine-squat', status: 'active' }
        },
        {
          exercises: { id: 'v1', slug: 'barbell-front-squat', status: 'active' }
        },
        { exercises: { id: 'v3', slug: 'old-squat', status: 'deprecated' } }
      ],
      progressions: [
        { exercises: { id: 'p1', slug: 'overhead-squat', status: 'active' } }
      ],
      regressions: [],
      exercise_media: [
        {
          type: 'image',
          url: 'https://cdn.example.com/b.png',
          thumbnail_url: null,
          angle: 'side',
          caption: 'Bottom position',
          is_primary: false,
          sort_order: 2,
          width: 800,
          height: 600,
          duration_seconds: null,
          status: 'active'
        },
        {
          type: 'image',
          url: 'https://cdn.example.com/a.png',
          thumbnail_url: 'https://cdn.example.com/a-thumb.png',
          angle: 'front',
          caption: null,
          is_primary: true,
          sort_order: 1,
          width: 800,
          height: 600,
          duration_seconds: null,
          status: 'active'
        },
        {
          type: 'video',
          url: 'https://cdn.example.com/draft.mp4',
          sort_order: 0,
          status: 'draft'
        }
      ]
    });

    expect(exercise).toMatchObject({
      primaryMuscles: ['quadriceps', 'glutes'],
      secondaryMuscles: ['adductors'],
      stabilizerMuscles: ['abs', 'lower-back'],
      equipment: ['barbell'],
      aliases: ['Back Squat', 'Barbell Squat'],
      variations: [
        { id: 'v1', slug: 'barbell-front-squat' },
        { id: 'v2', slug: 'smith-machine-squat' }
      ],
      progressions: [{ id: 'p1', slug: 'overhead-squat' }],
      regressions: []
    });
    expect(exercise.media).toEqual([
      {
        type: 'image',
        url: 'https://cdn.example.com/a.png',
        thumbnailUrl: 'https://cdn.example.com/a-thumb.png',
        angle: 'front',
        caption: null,
        isPrimary: true,
        sortOrder: 1,
        width: 800,
        height: 600,
        durationSeconds: null
      },
      {
        type: 'image',
        url: 'https://cdn.example.com/b.png',
        thumbnailUrl: null,
        angle: 'side',
        caption: 'Bottom position',
        isPrimary: false,
        sortOrder: 2,
        width: 800,
        height: 600,
        durationSeconds: null
      }
    ]);
  });

  it('returns empty arrays for an exercise with no links and no media', () => {
    const exercise = mapExerciseDetail({
      ...baseRow,
      exercise_aliases: [],
      exercise_primary_muscles: [],
      exercise_secondary_muscles: [],
      exercise_stabilizer_muscles: [],
      exercise_equipment: [],
      variations: [],
      progressions: [],
      regressions: [],
      exercise_media: []
    });

    expect(exercise).toMatchObject({
      primaryMuscles: [],
      secondaryMuscles: [],
      stabilizerMuscles: [],
      equipment: [],
      aliases: [],
      variations: [],
      progressions: [],
      regressions: [],
      media: []
    });
  });

  it('keeps every field existing clients already read', () => {
    const exercise = mapExerciseDetail(baseRow);

    for (const key of [
      'id',
      'slug',
      'name',
      'status',
      'category',
      'difficulty',
      'movementPattern',
      'tags',
      'updatedAt',
      'description',
      'instructions',
      'tips',
      'breathingCues',
      'contraindications',
      'forceType',
      'mechanics',
      'position',
      'planeOfMotion',
      'jointRegions',
      'laterality',
      'loadType',
      'skillType',
      'flags',
      'programming',
      'isPremium',
      'catalogVersion'
    ]) {
      expect(exercise).toHaveProperty(key);
    }
    expect(exercise.media).toEqual([]);
  });
});
