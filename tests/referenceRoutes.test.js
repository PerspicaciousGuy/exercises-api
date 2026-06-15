import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';

describe('reference routes', () => {
  it('returns metadata with references and enum values', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/metadata').expect(200);

    expect(referenceRepository.getMetadata).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: {
        muscles: [{ slug: 'chest', name: 'Chest' }],
        equipment: [{ slug: 'bodyweight', name: 'Bodyweight' }],
        categories: [{ slug: 'strength', name: 'Strength' }],
        exerciseFlags: [
          { slug: 'beginner-friendly', name: 'Beginner Friendly' }
        ],
        jointRegions: [{ slug: 'shoulder', name: 'Shoulder' }],
        enums: {
          difficulties: ['beginner', 'intermediate', 'advanced'],
          movementPatterns: [
            'squat',
            'hinge',
            'push',
            'pull',
            'carry',
            'rotation',
            'gait'
          ]
        }
      }
    });
  });

  it('returns muscles', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/muscles').expect(200);

    expect(referenceRepository.listMuscles).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: [{ slug: 'chest', name: 'Chest' }]
    });
  });

  it('returns equipment', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/equipment').expect(200);

    expect(referenceRepository.listEquipment).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: [{ slug: 'bodyweight', name: 'Bodyweight' }]
    });
  });

  it('returns categories', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/categories').expect(200);

    expect(referenceRepository.listCategories).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: [{ slug: 'strength', name: 'Strength' }]
    });
  });

  it('returns exercise flags', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/exercise-flags').expect(200);

    expect(referenceRepository.listExerciseFlags).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: [{ slug: 'beginner-friendly', name: 'Beginner Friendly' }]
    });
  });

  it('returns joint regions', async () => {
    const referenceRepository = createReferenceRepository();
    const app = createAppWithAuthBypass({ referenceRepository });

    const response = await request(app).get('/joint-regions').expect(200);

    expect(referenceRepository.listJointRegions).toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      data: [{ slug: 'shoulder', name: 'Shoulder' }]
    });
  });
});

function createReferenceRepository() {
  return {
    getMetadata: vi.fn(async () => ({
      muscles: [{ slug: 'chest', name: 'Chest' }],
      equipment: [{ slug: 'bodyweight', name: 'Bodyweight' }],
      categories: [{ slug: 'strength', name: 'Strength' }],
      exerciseFlags: [{ slug: 'beginner-friendly', name: 'Beginner Friendly' }],
      jointRegions: [{ slug: 'shoulder', name: 'Shoulder' }],
      enums: {
        difficulties: ['beginner', 'intermediate', 'advanced'],
        movementPatterns: [
          'squat',
          'hinge',
          'push',
          'pull',
          'carry',
          'rotation',
          'gait'
        ]
      }
    })),
    listMuscles: vi.fn(async () => [{ slug: 'chest', name: 'Chest' }]),
    listEquipment: vi.fn(async () => [
      { slug: 'bodyweight', name: 'Bodyweight' }
    ]),
    listCategories: vi.fn(async () => [{ slug: 'strength', name: 'Strength' }]),
    listExerciseFlags: vi.fn(async () => [
      { slug: 'beginner-friendly', name: 'Beginner Friendly' }
    ]),
    listJointRegions: vi.fn(async () => [
      { slug: 'shoulder', name: 'Shoulder' }
    ])
  };
}

function createAppWithAuthBypass(options) {
  return createApp({
    ...options,
    apiKeyMiddleware: allowApiKey
  });
}

function allowApiKey(_request, _response, next) {
  next();
}
