import { describe, expect, it } from 'vitest';

import {
  createSlug,
  normalizeExerciseName,
  toNameSearchPattern
} from '../src/utils/slugs.js';

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

  it('builds a search pattern that matches across spaces and hyphens', () => {
    expect(toNameSearchPattern('push up')).toBe('*push*up*');
    expect(toNameSearchPattern(' Pull-Up ')).toBe('*Pull*Up*');
    expect(toNameSearchPattern('press')).toBe('*press*');
  });
});
