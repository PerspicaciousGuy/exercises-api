import { describe, expect, it } from 'vitest';

import { createSlug } from '../src/utils/slugs.js';

describe('createSlug', () => {
  it('normalizes names to lowercase kebab-case slugs', () => {
    expect(createSlug('Dumbbell Shoulder Press')).toBe(
      'dumbbell-shoulder-press'
    );
    expect(createSlug('  Barbell  Back   Squat! ')).toBe('barbell-back-squat');
  });
});
