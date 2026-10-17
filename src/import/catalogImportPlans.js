import { createHash } from 'node:crypto';

export function buildReferenceSeedRows(references) {
  return {
    muscles: references.muscles.map(mapMuscleRow),
    equipment: references.equipment.map(mapEquipmentRow),
    categories: references.categories.map(mapCategoryRow),
    exerciseFlags: references.exerciseFlags.map(mapExerciseFlagRow),
    jointRegions: references.jointRegions.map(mapJointRegionRow)
  };
}

export function buildExerciseImportPlan({
  exercises,
  lookups,
  referenceDigest = null
}) {
  return {
    exercises: exercises.map((exercise) => mapExerciseRow(exercise, lookups)),
    aliases: flatMap(exercises, (exercise) => mapAliasRows(exercise, lookups)),
    primaryMuscles: flatMap(exercises, (exercise) =>
      mapMuscleRows(exercise, exercise.primaryMuscleSlugs, lookups)
    ),
    secondaryMuscles: flatMap(exercises, (exercise) =>
      mapMuscleRows(exercise, exercise.secondaryMuscleSlugs, lookups)
    ),
    stabilizerMuscles: flatMap(exercises, (exercise) =>
      mapMuscleRows(exercise, exercise.stabilizerMuscleSlugs, lookups)
    ),
    equipment: flatMap(exercises, (exercise) =>
      mapEquipmentRows(exercise, exercise.equipmentSlugs, lookups)
    ),
    optionalEquipment: flatMap(exercises, (exercise) =>
      mapEquipmentRows(exercise, exercise.optionalEquipmentSlugs, lookups)
    ),
    variations: flatMap(exercises, (exercise) =>
      mapRelatedExerciseRows(
        exercise,
        exercise.variationSlugs,
        lookups,
        'variation_id'
      )
    ),
    progressions: flatMap(exercises, (exercise) =>
      mapRelatedExerciseRows(
        exercise,
        exercise.progressionSlugs,
        lookups,
        'progression_id'
      )
    ),
    regressions: flatMap(exercises, (exercise) =>
      mapRelatedExerciseRows(
        exercise,
        exercise.regressionSlugs,
        lookups,
        'regression_id'
      )
    ),
    media: flatMap(exercises, (exercise) => mapMediaRows(exercise, lookups)),
    changeEvents: exercises.map((exercise) =>
      mapChangeEventRow(exercise, lookups, referenceDigest)
    )
  };
}

function mapMuscleRow(muscle) {
  return {
    name: muscle.name,
    slug: muscle.slug,
    region: muscle.region,
    muscle_group: muscle.muscleGroup,
    display_order: muscle.displayOrder
  };
}

function mapEquipmentRow(equipment) {
  return {
    name: equipment.name,
    slug: equipment.slug,
    equipment_group: equipment.equipmentGroup ?? null,
    display_order: equipment.displayOrder
  };
}

function mapCategoryRow(category) {
  return {
    name: category.name,
    slug: category.slug,
    category: category.category,
    description: category.description,
    display_order: category.displayOrder
  };
}

function mapExerciseFlagRow(flag) {
  return {
    name: flag.name,
    slug: flag.slug,
    description: flag.description,
    display_order: flag.displayOrder
  };
}

function mapJointRegionRow(jointRegion) {
  return {
    name: jointRegion.name,
    slug: jointRegion.slug,
    region_group: jointRegion.regionGroup ?? null,
    display_order: jointRegion.displayOrder
  };
}

function mapExerciseRow(exercise, lookups) {
  return {
    id: requiredLookup(lookups.exerciseIdsBySlug, exercise.slug, 'exercise'),
    name: exercise.name,
    slug: exercise.slug,
    status: exercise.status,
    description: exercise.description,
    instructions: exercise.instructions,
    tips: exercise.tips,
    breathing_cues: exercise.breathingCues ?? null,
    contraindications: exercise.contraindications,
    category_id: requiredLookup(
      lookups.categoryIdsBySlug,
      exercise.categorySlug,
      'category'
    ),
    difficulty: exercise.difficulty,
    movement_pattern: exercise.movementPattern,
    force_type: exercise.forceType ?? null,
    mechanics: exercise.mechanics,
    position: exercise.position ?? null,
    plane_of_motion: exercise.planeOfMotion ?? null,
    joint_regions: exercise.jointRegionSlugs,
    laterality: exercise.laterality ?? null,
    load_type: exercise.loadType ?? null,
    skill_type: exercise.skillType ?? null,
    tracking_type: exercise.trackingType,
    flags: exercise.flagSlugs,
    programming: exercise.programming,
    tags: exercise.tags,
    is_premium: exercise.isPremium,
    catalog_version: exercise.catalogVersion
  };
}

function mapAliasRows(exercise, lookups) {
  const exerciseId = requiredLookup(
    lookups.exerciseIdsBySlug,
    exercise.slug,
    'exercise'
  );

  return exercise.aliases.map((alias) => ({
    exercise_id: exerciseId,
    alias
  }));
}

function mapMuscleRows(exercise, muscleSlugs, lookups) {
  const exerciseId = requiredLookup(
    lookups.exerciseIdsBySlug,
    exercise.slug,
    'exercise'
  );

  return muscleSlugs.map((muscleSlug) => ({
    exercise_id: exerciseId,
    muscle_id: requiredLookup(lookups.muscleIdsBySlug, muscleSlug, 'muscle')
  }));
}

function mapEquipmentRows(exercise, equipmentSlugs, lookups) {
  const exerciseId = requiredLookup(
    lookups.exerciseIdsBySlug,
    exercise.slug,
    'exercise'
  );

  return equipmentSlugs.map((equipmentSlug) => ({
    exercise_id: exerciseId,
    equipment_id: requiredLookup(
      lookups.equipmentIdsBySlug,
      equipmentSlug,
      'equipment'
    )
  }));
}

function mapRelatedExerciseRows(exercise, relatedSlugs, lookups, relatedKey) {
  const exerciseId = requiredLookup(
    lookups.exerciseIdsBySlug,
    exercise.slug,
    'exercise'
  );

  return relatedSlugs.map((relatedSlug) => ({
    exercise_id: exerciseId,
    [relatedKey]: requiredLookup(
      lookups.exerciseIdsBySlug,
      relatedSlug,
      'exercise'
    )
  }));
}

function mapMediaRows(exercise, lookups) {
  const exerciseId = requiredLookup(
    lookups.exerciseIdsBySlug,
    exercise.slug,
    'exercise'
  );

  return exercise.media.map((media) => ({
    exercise_id: exerciseId,
    type: media.type,
    url: media.url,
    thumbnail_url: media.thumbnailUrl ?? null,
    angle: media.angle ?? null,
    caption: media.caption ?? null,
    mime_type: media.mimeType ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    duration_seconds: media.durationSeconds ?? null,
    source: media.source ?? null,
    is_primary: media.isPrimary,
    sort_order: media.sortOrder,
    status: media.status
  }));
}

function mapChangeEventRow(exercise, lookups, referenceDigest) {
  return {
    exercise_id: requiredLookup(
      lookups.exerciseIdsBySlug,
      exercise.slug,
      'exercise'
    ),
    change_type: 'updated',
    catalog_version: exercise.catalogVersion,
    payload: {
      slug: exercise.slug,
      fixtureImport: true,
      contentHash: hashExercise({ exercise, referenceDigest })
    }
  };
}

/**
 * A stable sha256 of any fixture value. The seeder hashes each exercise record
 * (links and aliases included) together with a digest of the reference
 * fixtures, and writes a change event whenever that differs from the
 * exercise's last event. So editing only a muscle, an alias, a relationship or
 * a reference display order still reaches `/sync/exercises`. An edit made in
 * the database by hand, outside the fixtures, is not detected.
 */
export function hashExercise(exercise) {
  return createHash('sha256').update(stableStringify(exercise)).digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function flatMap(items, mapper) {
  return items.flatMap((item) => mapper(item));
}

function requiredLookup(map, slug, label) {
  const value = map.get(slug);

  if (value === undefined) {
    throw new Error(`Missing ${label} lookup for slug "${slug}"`);
  }

  return value;
}
