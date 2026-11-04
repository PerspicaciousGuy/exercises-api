import { normalizeExerciseName } from '../utils/slugs.js';
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
    ...(filters.search
      ? { search_name: toSearchKeyFilter(filters.search) }
      : {}),
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

/**
 * Names and aliases are matched on their stored search keys (lowercase,
 * letters and digits only), so "pushup", "push up" and "Push-Up" are the same
 * query. A query with no letters or digits matches no name.
 */
function toSearchKeyFilter(query) {
  const key = normalizeExerciseName(query);

  // Every stored key has letters or digits, so eq. (empty) never matches.
  return key ? `ilike.*${key}*` : 'eq.';
}

// Search rank, best first: the exact name, an exact alias, a name that starts
// with the query, a name that contains it, an alias that contains it, a tag.
const RANK = {
  exactName: 0,
  exactAlias: 1,
  namePrefix: 2,
  nameContains: 3,
  aliasContains: 4,
  tag: 5
};

/**
 * Ranks every match before paging (see RANK), alphabetically within a rank,
 * so "Plank" comes before "Side Plank" on any page. Each source returns all
 * its matches: ranking needs them, and the catalog is a few hundred rows.
 */
export async function searchExerciseRows(client, { query, limit, offset }) {
  const key = normalizeExerciseName(query);
  const [aliasRows, nameRows, tagRows] = await Promise.all([
    key
      ? client.select('exercise_aliases', {
          columns: 'exercise_id,search_alias',
          filters: { search_alias: toSearchKeyFilter(query) }
        })
      : [],
    key
      ? selectExerciseSummaries(client, {
          search_name: toSearchKeyFilter(query)
        })
      : [],
    selectExerciseSummaries(client, {
      tags: `cs.${toPostgrestArrayLiteral(query)}`
    })
  ]);
  const aliasExerciseRows = await selectExerciseSummaryRowsByIds(
    client,
    unique(aliasRows.map((row) => row.exercise_id))
  );
  const exactAliasIds = new Set(
    aliasRows
      .filter((row) => row.search_alias === key)
      .map((row) => row.exercise_id)
  );
  const rankById = new Map();
  const rank = (row, value) =>
    rankById.set(row.id, Math.min(value, rankById.get(row.id) ?? value));

  for (const row of nameRows) {
    const nameKey = normalizeExerciseName(row.name);
    rank(
      row,
      nameKey === key
        ? RANK.exactName
        : nameKey.startsWith(key)
          ? RANK.namePrefix
          : RANK.nameContains
    );
  }
  for (const row of aliasExerciseRows) {
    rank(row, exactAliasIds.has(row.id) ? RANK.exactAlias : RANK.aliasContains);
  }
  for (const row of tagRows) {
    rank(row, RANK.tag);
  }

  return uniqueExerciseRows([...nameRows, ...aliasExerciseRows, ...tagRows])
    .sort(
      (a, b) =>
        rankById.get(a.id) - rankById.get(b.id) || compareNames(a.name, b.name)
    )
    .slice(offset, offset + limit);
}

function compareNames(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
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

  // ?equipment= matches exercises that need the item or can use it.
  const relationRows = await Promise.all([
    selectExerciseIds(
      client,
      'exercise_equipment',
      'equipment_id',
      equipment.id
    ),
    selectExerciseIds(
      client,
      'exercise_optional_equipment',
      'equipment_id',
      equipment.id
    )
  ]);

  return unique(relationRows.flat());
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
