import {
  DETAIL_COLUMNS,
  SUMMARY_COLUMNS,
  mapExerciseDetail
} from './exerciseMappers.js';

const RELATION_CONFIG = {
  variations: {
    table: 'exercise_variations',
    idColumn: 'variation_id'
  },
  progressions: {
    table: 'exercise_progressions',
    idColumn: 'progression_id'
  },
  regressions: {
    table: 'exercise_regressions',
    idColumn: 'regression_id'
  }
};

export function buildListFilters(filters, exerciseIds) {
  return {
    status: filters.includeDeprecated ? 'in.(active,deprecated)' : 'eq.active',
    deleted_at: 'is.null',
    ...(filters.difficulty ? { difficulty: `eq.${filters.difficulty}` } : {}),
    ...(filters.category
      ? { 'categories.slug': `eq.${filters.category}` }
      : {}),
    ...(filters.search ? { name: `ilike.*${filters.search}*` } : {}),
    ...(filters.updatedSince
      ? { updated_at: `gt.${filters.updatedSince}` }
      : {}),
    ...(exerciseIds ? { id: `in.(${exerciseIds.join(',')})` } : {}),
    order: 'name.asc',
    limit: String(filters.limit),
    offset: String(filters.offset)
  };
}

export async function findMatchingExerciseIds(client, filters) {
  const idSets = [];

  if (filters.muscle) {
    idSets.push(await findExerciseIdsByMuscle(client, filters.muscle));
  }

  if (filters.equipment) {
    idSets.push(await findExerciseIdsByEquipment(client, filters.equipment));
  }

  return idSets.length > 0 ? intersectSets(idSets) : undefined;
}

export async function searchExerciseRows(client, { query, limit, offset }) {
  const searchLimit = limit + offset;
  const [aliasRows, nameRows, tagRows] = await Promise.all([
    client.select('exercise_aliases', {
      columns: 'exercise_id',
      filters: {
        alias: `ilike.*${query}*`
      }
    }),
    selectExerciseSummaries(client, {
      name: `ilike.*${query}*`,
      limit: String(searchLimit)
    }),
    selectExerciseSummaries(client, {
      tags: `cs.${toPostgrestArrayLiteral(query)}`,
      limit: String(searchLimit)
    })
  ]);
  const aliasExerciseRows = await selectExerciseSummaryRowsByIds(
    client,
    unique(aliasRows.map((row) => row.exercise_id))
  );

  return uniqueExerciseRows([
    ...nameRows,
    ...aliasExerciseRows,
    ...tagRows
  ]).slice(offset, offset + limit);
}

export async function selectOneExercise(client, identityFilter) {
  const rows = await client.select('exercises', {
    columns: DETAIL_COLUMNS,
    filters: {
      ...identityFilter,
      status: 'eq.active',
      deleted_at: 'is.null',
      limit: '1'
    }
  });

  return rows[0] ? mapExerciseDetail(rows[0]) : null;
}

export async function selectExerciseDetailRowsByIds(client, ids) {
  if (ids.length === 0) {
    return [];
  }

  return client.select('exercises', {
    columns: DETAIL_COLUMNS,
    filters: {
      id: `in.(${ids.join(',')})`,
      status: 'eq.active',
      deleted_at: 'is.null'
    }
  });
}

export async function selectExerciseSummaryRowsByRelation(client, input) {
  const relation = RELATION_CONFIG[input.relationType];
  const rows = await client.select(relation.table, {
    columns: relation.idColumn,
    filters: {
      exercise_id: `eq.${input.exerciseId}`
    }
  });

  return selectExerciseSummaryRowsByIds(
    client,
    rows.map((row) => row[relation.idColumn])
  );
}

const MUSCLE_ROLE_TABLES = {
  primary: 'exercise_primary_muscles',
  secondary: 'exercise_secondary_muscles'
};

/**
 * For a set of exercise ids, returns each exercise's primary and secondary
 * muscle slugs. Stabilizers are excluded on purpose: coverage analysis reasons
 * about muscles a movement trains, not those that merely brace.
 */
export async function selectMuscleSlugsByExerciseIds(client, ids) {
  if (ids.length === 0) {
    return new Map();
  }

  const [primaryRows, secondaryRows] = await Promise.all([
    selectMuscleRoleRows(client, MUSCLE_ROLE_TABLES.primary, ids),
    selectMuscleRoleRows(client, MUSCLE_ROLE_TABLES.secondary, ids)
  ]);

  const byExercise = new Map(
    ids.map((id) => [id, { primary: [], secondary: [] }])
  );

  for (const row of primaryRows) {
    byExercise.get(row.exercise_id)?.primary.push(row.muscles.slug);
  }
  for (const row of secondaryRows) {
    byExercise.get(row.exercise_id)?.secondary.push(row.muscles.slug);
  }

  return byExercise;
}

async function selectMuscleRoleRows(client, table, ids) {
  return client.select(table, {
    columns: 'exercise_id,muscles(slug)',
    filters: {
      exercise_id: `in.(${ids.join(',')})`
    }
  });
}

/**
 * For a set of exercise ids, returns each exercise's equipment slugs. Used to
 * keep only the substitutes a caller can perform with the equipment they have.
 */
export async function selectEquipmentSlugsByExerciseIds(client, ids) {
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await client.select('exercise_equipment', {
    columns: 'exercise_id,equipment(slug)',
    filters: {
      exercise_id: `in.(${ids.join(',')})`
    }
  });

  const byExercise = new Map(ids.map((id) => [id, []]));
  for (const row of rows) {
    byExercise.get(row.exercise_id)?.push(row.equipment.slug);
  }

  return byExercise;
}

async function findExerciseIdsByMuscle(client, slug) {
  const muscle = await selectOneBySlug(client, 'muscles', slug);

  if (!muscle) {
    return [];
  }

  const relationRows = await Promise.all([
    selectExerciseIds(
      client,
      'exercise_primary_muscles',
      'muscle_id',
      muscle.id
    ),
    selectExerciseIds(
      client,
      'exercise_secondary_muscles',
      'muscle_id',
      muscle.id
    ),
    selectExerciseIds(
      client,
      'exercise_stabilizer_muscles',
      'muscle_id',
      muscle.id
    )
  ]);

  return unique(relationRows.flat());
}

async function findExerciseIdsByEquipment(client, slug) {
  const equipment = await selectOneBySlug(client, 'equipment', slug);

  if (!equipment) {
    return [];
  }

  return selectExerciseIds(
    client,
    'exercise_equipment',
    'equipment_id',
    equipment.id
  );
}

async function selectOneBySlug(client, table, slug) {
  const rows = await client.select(table, {
    columns: 'id,slug',
    filters: {
      slug: `eq.${slug}`,
      limit: '1'
    }
  });

  return rows[0] ?? null;
}

async function selectExerciseIds(client, table, foreignKey, value) {
  const rows = await client.select(table, {
    columns: 'exercise_id',
    filters: {
      [foreignKey]: `eq.${value}`
    }
  });

  return rows.map((row) => row.exercise_id);
}

async function selectExerciseSummaries(client, filters) {
  return client.select('exercises', {
    columns: SUMMARY_COLUMNS,
    filters: {
      status: 'eq.active',
      deleted_at: 'is.null',
      order: 'name.asc',
      ...filters
    }
  });
}

export async function selectExerciseSummaryRowsByIds(client, ids) {
  if (ids.length === 0) {
    return [];
  }

  return selectExerciseSummaries(client, {
    id: `in.(${ids.join(',')})`
  });
}

/**
 * Every progression edge in the catalog as `{ from, to }` id pairs. The graph
 * is small (tens of edges), so pathfinding loads it whole and walks it in
 * memory rather than issuing a recursive query per request.
 */
export async function selectAllProgressionEdges(client) {
  const rows = await client.select('exercise_progressions', {
    columns: 'exercise_id,progression_id'
  });

  return rows.map((row) => ({
    from: row.exercise_id,
    to: row.progression_id
  }));
}

function intersectSets(idSets) {
  const [firstSet, ...remainingSets] = idSets.map((ids) => new Set(ids));

  return [...firstSet].filter((id) =>
    remainingSets.every((set) => set.has(id))
  );
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueExerciseRows(rows) {
  const rowsById = new Map();

  for (const row of rows) {
    rowsById.set(row.id, row);
  }

  return [...rowsById.values()];
}

function toPostgrestArrayLiteral(value) {
  const escapedValue = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  return `{"${escapedValue}"}`;
}
