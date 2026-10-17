// The one list of catalog enum values. The fixture validator, `/metadata` and
// `/sync/metadata` all read it, and tests/catalogEnums.test.js checks it against
// the Postgres enum types in supabase/migrations, so a value added to the
// database cannot go missing from the API again.

export const CATALOG_ENUM_VALUES = {
  difficulties: ['beginner', 'intermediate', 'advanced'],
  movementPatterns: [
    'squat',
    'hinge',
    'push',
    'pull',
    'carry',
    'rotation',
    'gait',
    'core'
  ],
  forceTypes: ['push', 'pull', 'static', 'compound'],
  mechanics: ['compound', 'isolation'],
  positions: ['standing', 'seated', 'lying', 'kneeling', 'other'],
  planesOfMotion: ['sagittal', 'frontal', 'transverse', 'multi_planar'],
  lateralities: ['bilateral', 'unilateral', 'alternating', 'single_side'],
  loadTypes: [
    'bodyweight',
    'free_weight',
    'machine',
    'cable',
    'band',
    'cardio_machine',
    'assisted',
    'other'
  ],
  skillTypes: [
    'strength',
    'power',
    'endurance',
    'mobility',
    'balance',
    'coordination'
  ],
  mediaTypes: ['image', 'video', 'gif', 'thumbnail'],
  trackingTypes: [
    'weight_reps',
    'reps',
    'assisted_reps',
    'band_reps',
    'duration',
    'weight_duration',
    'distance_duration',
    'weight_distance'
  ]
};

// Enums the fixtures use that the API does not publish under `enums`.
export const EXERCISE_STATUSES = ['draft', 'active', 'deprecated'];
export const CATEGORY_TYPES = [
  'strength',
  'cardio',
  'flexibility',
  'plyometrics',
  'mobility'
];
export const MEDIA_STATUSES = ['draft', 'active', 'archived'];
