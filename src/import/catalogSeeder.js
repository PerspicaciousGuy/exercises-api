import { randomUUID } from 'node:crypto';

import {
  buildExerciseImportPlan,
  buildReferenceSeedRows
} from './catalogImportPlans.js';

export async function seedReferenceData({ client, references }) {
  const rows = buildReferenceSeedRows(references);
  const categories = await client.upsert('categories', rows.categories, {
    onConflict: 'slug'
  });
  const equipment = await client.upsert('equipment', rows.equipment, {
    onConflict: 'slug'
  });
  const exerciseFlags = await client.upsert(
    'exercise_flags',
    rows.exerciseFlags,
    {
      onConflict: 'slug'
    }
  );
  const jointRegions = await client.upsert('joint_regions', rows.jointRegions, {
    onConflict: 'slug'
  });
  const muscles = await client.upsert('muscles', rows.muscles, {
    onConflict: 'slug'
  });

  return {
    categoryIdsBySlug: mapIdsBySlug(categories),
    equipmentIdsBySlug: mapIdsBySlug(equipment),
    exerciseFlagIdsBySlug: mapIdsBySlug(exerciseFlags),
    jointRegionIdsBySlug: mapIdsBySlug(jointRegions),
    muscleIdsBySlug: mapIdsBySlug(muscles)
  };
}

export async function importExerciseData({
  client,
  exercises,
  referenceLookups,
  idFactory = randomUUID
}) {
  const exerciseIdsBySlug = await buildExerciseIdsBySlug({
    client,
    exercises,
    idFactory
  });
  const plan = buildExerciseImportPlan({
    exercises,
    lookups: {
      ...referenceLookups,
      exerciseIdsBySlug
    }
  });

  await upsertExercisePlan(client, plan);
  await insertMissingChangeEvents(client, plan.changeEvents);

  return plan;
}

export async function importCatalogFixtures({ client, fixtures, idFactory }) {
  const referenceLookups = await seedReferenceData({
    client,
    references: fixtures.references
  });

  return importExerciseData({
    client,
    exercises: fixtures.exercises,
    referenceLookups,
    idFactory
  });
}

async function buildExerciseIdsBySlug({ client, exercises, idFactory }) {
  const existingRows = await selectExistingExerciseIds(client, exercises);
  const idsBySlug = mapIdsBySlug(existingRows);

  for (const exercise of exercises) {
    if (!idsBySlug.has(exercise.slug)) {
      idsBySlug.set(exercise.slug, idFactory());
    }
  }

  return idsBySlug;
}

async function selectExistingExerciseIds(client, exercises) {
  if (exercises.length === 0) {
    return [];
  }

  return client.select('exercises', {
    columns: 'id,slug',
    filters: {
      slug: `in.(${exercises.map((exercise) => exercise.slug).join(',')})`
    }
  });
}

async function upsertExercisePlan(client, plan) {
  await client.upsert('exercises', plan.exercises, { onConflict: 'slug' });
  await client.upsert('exercise_aliases', plan.aliases, {
    onConflict: 'exercise_id,alias'
  });
  await client.upsert('exercise_primary_muscles', plan.primaryMuscles, {
    onConflict: 'exercise_id,muscle_id'
  });
  await client.upsert('exercise_secondary_muscles', plan.secondaryMuscles, {
    onConflict: 'exercise_id,muscle_id'
  });
  await client.upsert('exercise_stabilizer_muscles', plan.stabilizerMuscles, {
    onConflict: 'exercise_id,muscle_id'
  });
  await client.upsert('exercise_equipment', plan.equipment, {
    onConflict: 'exercise_id,equipment_id'
  });
  await client.upsert('exercise_variations', plan.variations, {
    onConflict: 'exercise_id,variation_id'
  });
  await client.upsert('exercise_progressions', plan.progressions, {
    onConflict: 'exercise_id,progression_id'
  });
  await client.upsert('exercise_regressions', plan.regressions, {
    onConflict: 'exercise_id,regression_id'
  });
  await client.insert('exercise_media', plan.media);
}

async function insertMissingChangeEvents(client, changeEvents) {
  const missingEvents = [];

  for (const changeEvent of changeEvents) {
    if (!(await hasChangeEvent(client, changeEvent))) {
      missingEvents.push(changeEvent);
    }
  }

  await client.insert('exercise_change_events', missingEvents);
}

async function hasChangeEvent(client, changeEvent) {
  const rows = await client.select('exercise_change_events', {
    columns: 'id',
    filters: {
      exercise_id: `eq.${changeEvent.exercise_id}`,
      catalog_version: `eq.${changeEvent.catalog_version}`,
      limit: '1'
    }
  });

  return rows.length > 0;
}

function mapIdsBySlug(rows) {
  return new Map(rows.map((row) => [row.slug, row.id]));
}
