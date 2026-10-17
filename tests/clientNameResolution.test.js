import { describe, expect, it } from 'vitest';

import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';
import { normalizeExerciseName } from '../src/utils/slugs.js';

// Names a client app (Strive) stores in existing workouts, and the exercise
// each must resolve to. Resolution is a lookup of normalizeExerciseName over
// every exercise's name and aliases, which is what the app does offline.
const EXPECTED = {
  'Incline Bench Press (Barbell)': 'incline-barbell-bench-press',
  'Incline Bench Press (Dumbbell)': 'incline-dumbbell-bench-press',
  'Cable Crossover': 'high-to-low-cable-fly',
  'Pec Deck Machine': 'pec-deck',
  'Machine Chest Press': 'chest-press-machine',
  'Incline Machine Chest Press': 'incline-chest-press-machine',
  Deadlift: 'barbell-deadlift',
  'Chest-Supported Dumbbell Row': 'chest-supported-row',
  'Seated Cable Row': 'cable-row',
  'Overhead Press (Dumbbell)': 'dumbbell-shoulder-press',
  'Overhead Press (Barbell)': 'barbell-overhead-press',
  'Bench Press (Barbell)': 'barbell-bench-press',
  'Bench Press (Dumbbell)': 'dumbbell-bench-press',
  'Lateral Raise': 'dumbbell-lateral-raise',
  'Front Raise': 'dumbbell-front-raise',
  'Rear Delt Fly': 'reverse-dumbbell-fly',
  'Overhead Cable Extension': 'cable-overhead-extension',
  'Overhead Tricep Extension (Dumbbell)': 'dumbbell-overhead-extension',
  'Tricep Pushdown': 'triceps-pushdown',
  'Tricep Kickback': 'triceps-kickback',
  'Tricep Dip': 'dip',
  'Assisted Dip': 'assisted-dip-machine',
  'Barbell Squat': 'barbell-back-squat',
  'Front Squat': 'barbell-front-squat',
  'Band Squat': 'banded-squat',
  'Nordic Curl': 'nordic-hamstring-curl',
  'Cable Kickback': 'glute-kickback',
  'Standing Calf Raise (Machine)': 'standing-calf-raise-machine',
  'Leg Press Calf Raise': 'calf-press-leg-press',
  'Band Pallof Press': 'band-pallof-press',
  'Cable Shrug': 'cable-shrug',
  Elliptical: 'elliptical-trainer',
  'Rowing Machine': 'rowing-erg',
  'Stationary Bike': 'stationary-bike-ride',
  'Push-Up': 'push-up',
  'Pull-Up': 'pull-up',
  'Decline Bench Press (Barbell)': 'decline-barbell-bench-press',
  'Decline Bench Press (Dumbbell)': 'decline-dumbbell-bench-press',
  'Dumbbell Fly': 'dumbbell-fly',
  'Incline Dumbbell Fly': 'incline-dumbbell-fly',
  'Cable Fly (High-to-Low)': 'high-to-low-cable-fly',
  'Cable Fly (Low-to-High)': 'low-to-high-cable-fly',
  'Wide Push-Up': 'wide-push-up',
  'Band Fly': 'band-fly',
  'Pendlay Row': 'pendlay-row',
  'Single-Arm Dumbbell Row': 'dumbbell-row',
  'Meadows Row': 'meadows-row',
  'Wide-Grip Pull-Up': 'wide-grip-pull-up',
  'Neutral-Grip Pull-Up': 'neutral-grip-pull-up',
  'Close-Grip Lat Pulldown': 'close-grip-lat-pulldown',
  'Single-Arm Cable Row': 'single-arm-cable-row',
  'Seated Overhead Press (Barbell)': 'seated-barbell-overhead-press',
  'Seated Overhead Press (Dumbbell)': 'dumbbell-shoulder-press',
  'Arnold Press': 'arnold-press',
  'Seated Lateral Raise': 'seated-dumbbell-lateral-raise',
  'Machine Lateral Raise': 'machine-lateral-raise',
  'Cable Rear Delt Row': 'cable-rear-delt-row',
  'Machine Biceps Curl': 'machine-biceps-curl',
  'Concentration Curl': 'concentration-curl',
  'Spider Curl': 'spider-curl',
  'Hammer Cable Curl': 'cable-hammer-curl',
  'Band Biceps Curl': 'band-biceps-curl',
  'Dumbbell Skull Crusher': 'dumbbell-skull-crusher',
  'JM Press': 'jm-press',
  'Rope Pushdown': 'triceps-pushdown',
  'Machine Tricep Dip': 'machine-triceps-dip',
  'Curtsy Lunge': 'curtsy-lunge',
  'Jump Squat': 'jump-squat',
  'Wall Sit': 'wall-sit',
  'Stiff-Leg Deadlift': 'stiff-leg-deadlift',
  'Glute-Ham Raise': 'glute-ham-raise',
  'Slider Leg Curl': 'slider-leg-curl',
  'Dumbbell Hip Thrust': 'dumbbell-hip-thrust',
  'Single-Leg Hip Thrust': 'single-leg-hip-thrust',
  'Band Glute Bridge': 'band-glute-bridge',
  'Fire Hydrant': 'fire-hydrant',
  'Standing Calf Raise (Barbell)': 'barbell-calf-raise',
  'Donkey Calf Raise': 'donkey-calf-raise',
  'Single-Leg Calf Raise': 'single-leg-calf-raise',
  'Decline Crunch': 'decline-crunch',
  "Captain's Chair Leg Raise": 'captains-chair-leg-raise',
  'Flutter Kick': 'flutter-kick',
  'Smith Machine Shrug': 'smith-machine-shrug',
  'Wrist Curl': 'dumbbell-wrist-curl',
  'Reverse Wrist Curl': 'dumbbell-reverse-wrist-curl',
  'Reverse Curl': 'barbell-reverse-curl',
  'Dead Hang': 'dead-hang',
  'Plate Pinch Hold': 'plate-pinch-hold',
  'Goblet Clean': 'goblet-clean',
  'Turkish Get-Up': 'turkish-get-up',
  'Clean and Press': 'clean-and-press',
  'Power Clean': 'power-clean',
  'Hang Clean': 'hang-clean',
  Thruster: 'thruster',
  'Wall Ball': 'wall-ball',
  'Man Maker': 'man-maker',
  'Outdoor Run': 'outdoor-run',
  'Incline Treadmill Walk': 'incline-treadmill-walk',
  'Cycling (Outdoor)': 'outdoor-cycling',
  Swimming: 'swimming'
};

describe('client exercise name resolution', () => {
  it('resolves every stored client name to exactly one exercise', async () => {
    const { exercises } = await loadCatalogFixtures();
    const slugByName = new Map();

    for (const exercise of exercises) {
      for (const name of [exercise.name, ...exercise.aliases]) {
        slugByName.set(normalizeExerciseName(name), exercise.slug);
      }
    }

    const resolved = Object.fromEntries(
      Object.keys(EXPECTED).map((name) => [
        name,
        slugByName.get(normalizeExerciseName(name)) ?? null
      ])
    );

    expect(resolved).toEqual(EXPECTED);
  });
});
