import { describe, expect, it } from 'vitest';

import { createSlug, normalizeExerciseName } from '../src/utils/slugs.js';

describe('createSlug', () => {
  it('normalizes names to lowercase kebab-case slugs', () => {
    expect(createSlug('Dumbbell Shoulder Press')).toBe(
      'dumbbell-shoulder-press'
    );
    expect(createSlug('  Barbell  Back   Squat! ')).toBe('barbell-back-squat');
  });
});

describe('exercise name matching', () => {
  it('compares names ignoring case, spaces, hyphens and punctuation', () => {
    const key = normalizeExerciseName('Push-Up');

    expect(normalizeExerciseName('push up')).toBe(key);
    expect(normalizeExerciseName('Pushup')).toBe(key);
    expect(normalizeExerciseName("Farmer's Walk")).toBe('farmerswalk');
    expect(normalizeExerciseName('Incline Bench Press (Barbell)')).toBe(
      'inclinebenchpressbarbell'
    );
  });
});
