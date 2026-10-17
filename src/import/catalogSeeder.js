import { randomUUID } from 'node:crypto';

import {
  buildExerciseImportPlan,
  buildReferenceSeedRows,
  hashExercise
} from './catalogImportPlans.js';

/**
 * The join tables reconciled after upsert, and the plan key and related-id
 * column each is keyed on. Aliases and media are keyed on free text (the alias,
 * the url), which cannot go in a PostgREST `not.in.(...)` filter without
 * brittle quoting, so `TEXT_KEYED_TABLES` reconciles them by row id instead.
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
    table: 'exercise_optional_equipment',
    relatedColumn: 'equipment_id',
    planKey: 'optionalEquipment'
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

const TEXT_KEYED_TABLES = [
  { table: 'exercise_aliases', keyColumn: 'alias', planKey: 'aliases' },
  { table: 'exercise_media', keyColumn: 'url', planKey: 'media' }
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
  referenceDigest,
  idFactory = randomUUID
}) {
  const exerciseIdsBySlug = await buildExerciseIdsBySlug({
    client,
    exercises,
    idFactory
  });
  const plan = buildExerciseImportPlan({
    exercises,
    referenceDigest,
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
    // Records publish muscles and equipment in reference display order, so a
    // reference edit re-emits every exercise.
    referenceDigest: hashExercise(fixtures.references),
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
  await client.upsert('exercise_optional_equipment', plan.optionalEquipment, {
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
  await client.upsert('exercise_media', plan.media, {
    onConflict: 'exercise_id,url'
  });
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
  for (const { table, keyColumn, planKey } of TEXT_KEYED_TABLES) {
    await deleteStaleTextKeyedRows(client, {
      table,
      keyColumn,
      keptRows: plan[planKey],
      exerciseIds: seededExerciseIds
    });
  }

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

// shortcut: one select reads every existing row for the seeded exercises, which
// PostgREST caps at its max-rows setting (1000 on Supabase); page it once
// aliases plus media for a seed run can pass that.
async function deleteStaleTextKeyedRows(
  client,
  { table, keyColumn, keptRows, exerciseIds }
) {
  if (exerciseIds.length === 0) {
    return;
  }

  const rowKey = (row) => `${row.exercise_id}\u0000${row[keyColumn]}`;
  const kept = new Set(keptRows.map(rowKey));
  const existingRows = await client.select(table, {
    columns: `id,exercise_id,${keyColumn}`,
    filters: { exercise_id: `in.(${exerciseIds.join(',')})` }
  });
  const staleIds = existingRows
    .filter((row) => !kept.has(rowKey(row)))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await client.delete(table, {
      filters: { id: `in.(${staleIds.join(',')})` },
      select: 'id'
    });
  }
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
    const latestHash = await selectLatestContentHash(
      client,
      changeEvent.exercise_id
    );

    if (latestHash !== changeEvent.payload.contentHash) {
      missingEvents.push(changeEvent);
    }
  }

  await client.insert('exercise_change_events', missingEvents);
}

// Events written before content hashes existed have none, so the first seed
// after this change emits one event per exercise: every client re-syncs once
// and picks up the fields added to the full record.
async function selectLatestContentHash(client, exerciseId) {
  const rows = await client.select('exercise_change_events', {
    columns: 'payload',
    filters: {
      exercise_id: `eq.${exerciseId}`,
      order: 'id.desc',
      limit: '1'
    }
  });

  return rows[0]?.payload?.contentHash;
}

function mapIdsBySlug(rows) {
  return new Map(rows.map((row) => [row.slug, row.id]));
}
