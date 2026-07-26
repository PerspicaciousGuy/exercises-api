import { randomUUID } from 'node:crypto';

import {
  buildExerciseImportPlan,
  buildReferenceSeedRows
} from './catalogImportPlans.js';

/**
 * The join tables reconciled after upsert, and the plan key and related-id
 * column each is keyed on. `exercise_aliases` is deliberately absent: its
 * related value is free text, which cannot be placed in a PostgREST
 * `not.in.(...)` filter without brittle quoting, and a stale alias is harmless
 * next to a stale muscle or relationship link. Aliases are additive-only for
 * now; reconciling them is a separate task if it ever earns one.
 */
const EXERCISE_LINK_TABLES = [
  {
    table: 'exercise_primary_muscles',
    relatedColumn: 'muscle_id',
    planKey: 'primaryMuscles'
  },
  {
    table: 'exercise_secondary_muscles',
    relatedColumn: 'muscle_id',
    planKey: 'secondaryMuscles'
  },
  {
    table: 'exercise_stabilizer_muscles',
    relatedColumn: 'muscle_id',
    planKey: 'stabilizerMuscles'
  },
  {
    table: 'exercise_equipment',
    relatedColumn: 'equipment_id',
    planKey: 'equipment'
  },
  {
    table: 'exercise_variations',
    relatedColumn: 'variation_id',
    planKey: 'variations'
  },
  {
    table: 'exercise_progressions',
    relatedColumn: 'progression_id',
    planKey: 'progressions'
  },
  {
    table: 'exercise_regressions',
    relatedColumn: 'regression_id',
    planKey: 'regressions'
  }
];

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
  await reconcileExerciseLinks(client, plan, [...exerciseIdsBySlug.values()]);
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

/**
 * The join-table upserts above only add and update rows; they never remove a
 * link that a record used to have and no longer does. Repointing an exercise
 * from `back` to `lats` would otherwise leave it reporting both muscles.
 *
 * This runs *after* the upserts (never before), so a mid-run failure can only
 * ever leave an extra stale link — a superset a reader tolerates — and never a
 * missing one. Each pass is scoped to the exercises in this seed run: an
 * exercise absent from the fixtures is not being reconciled and is left alone.
 */
async function reconcileExerciseLinks(client, plan, seededExerciseIds) {
  for (const { table, relatedColumn, planKey } of EXERCISE_LINK_TABLES) {
    const keptRelatedIdsByExercise = groupRelatedIdsByExercise(
      plan[planKey],
      relatedColumn
    );

    for (const exerciseId of seededExerciseIds) {
      await deleteStaleLinks(
        client,
        table,
        relatedColumn,
        exerciseId,
        keptRelatedIdsByExercise.get(exerciseId) ?? []
      );
    }
  }
}

async function deleteStaleLinks(
  client,
  table,
  relatedColumn,
  exerciseId,
  keptRelatedIds
) {
  const filters = { exercise_id: `eq.${exerciseId}` };

  if (keptRelatedIds.length > 0) {
    filters[relatedColumn] = `not.in.(${keptRelatedIds.join(',')})`;
  }

  await client.delete(table, { filters, select: relatedColumn });
}

function groupRelatedIdsByExercise(rows, relatedColumn) {
  const idsByExercise = new Map();

  for (const row of rows) {
    const ids = idsByExercise.get(row.exercise_id) ?? [];

    ids.push(row[relatedColumn]);
    idsByExercise.set(row.exercise_id, ids);
  }

  return idsByExercise;
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
