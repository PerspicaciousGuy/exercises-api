export const SUMMARY_COLUMNS =
  'id,slug,name,status,difficulty,movement_pattern,tags,updated_at,categories(slug,name)';

export const DETAIL_COLUMNS = [
  'id',
  'slug',
  'name',
  'status',
  'description',
  'instructions',
  'tips',
  'breathing_cues',
  'contraindications',
  'difficulty',
  'movement_pattern',
  'force_type',
  'mechanics',
  'position',
  'plane_of_motion',
  'joint_regions',
  'laterality',
  'load_type',
  'skill_type',
  'tracking_type',
  'flags',
  'programming',
  'tags',
  'is_premium',
  'catalog_version',
  'updated_at',
  'categories(slug,name)',
  'exercise_aliases(alias)',
  'exercise_primary_muscles(muscles(slug,display_order))',
  'exercise_secondary_muscles(muscles(slug,display_order))',
  'exercise_stabilizer_muscles(muscles(slug,display_order))',
  'exercise_equipment(equipment(slug,display_order))',
  'exercise_optional_equipment(equipment(slug,display_order))',
  relationEmbed('variations', 'variation_id'),
  relationEmbed('progressions', 'progression_id'),
  relationEmbed('regressions', 'regression_id'),
  'exercise_media(type,url,thumbnail_url,angle,caption,is_primary,sort_order,width,height,duration_seconds,status)'
].join(',');

// The relation tables hold two foreign keys to `exercises`, so each embed names
// the one to follow: rows owned by this exercise, pointing at the related one.
function relationEmbed(key, relatedColumn) {
  const table = `exercise_${key}`;

  return `${key}:${table}!${table}_exercise_id_fkey(exercises!${table}_${relatedColumn}_fkey(id,slug,status))`;
}

export function mapExerciseSummary(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    category: row.categories?.slug ?? null,
    difficulty: row.difficulty,
    movementPattern: row.movement_pattern,
    tags: row.tags,
    updatedAt: row.updated_at
  };
}

export function mapExerciseDetail(row) {
  return {
    ...mapExerciseSummary(row),
    description: row.description,
    instructions: row.instructions,
    tips: row.tips,
    breathingCues: row.breathing_cues,
    contraindications: row.contraindications,
    forceType: row.force_type,
    mechanics: row.mechanics,
    position: row.position,
    planeOfMotion: row.plane_of_motion,
    jointRegions: row.joint_regions,
    laterality: row.laterality,
    loadType: row.load_type,
    skillType: row.skill_type,
    flags: row.flags,
    programming: row.programming,
    isPremium: row.is_premium,
    catalogVersion: row.catalog_version,
    primaryMuscles: slugsByDisplayOrder(
      row.exercise_primary_muscles,
      'muscles'
    ),
    secondaryMuscles: slugsByDisplayOrder(
      row.exercise_secondary_muscles,
      'muscles'
    ),
    stabilizerMuscles: slugsByDisplayOrder(
      row.exercise_stabilizer_muscles,
      'muscles'
    ),
    equipment: slugsByDisplayOrder(row.exercise_equipment, 'equipment'),
    optionalEquipment: slugsByDisplayOrder(
      row.exercise_optional_equipment,
      'equipment'
    ),
    trackingType: row.tracking_type ?? null,
    aliases: (row.exercise_aliases ?? []).map((item) => item.alias).sort(),
    variations: activeExerciseRefs(row.variations),
    progressions: activeExerciseRefs(row.progressions),
    regressions: activeExerciseRefs(row.regressions),
    media: (row.exercise_media ?? [])
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapMedia)
  };
}

// Embedded join rows arrive in no particular order; sort them so the same
// record always serialises the same way.
function slugsByDisplayOrder(rows = [], referenceKey) {
  return rows
    .map((item) => item[referenceKey])
    .sort(
      (a, b) => a.display_order - b.display_order || compare(a.slug, b.slug)
    )
    .map((reference) => reference.slug);
}

// Matches the relation endpoints: links to inactive exercises are not shown.
function activeExerciseRefs(rows = []) {
  return rows
    .map((item) => item.exercises)
    .filter((exercise) => exercise?.status === 'active')
    .sort((a, b) => compare(a.slug, b.slug))
    .map(({ id, slug }) => ({ id, slug }));
}

function mapMedia(item) {
  return {
    type: item.type,
    url: item.url,
    thumbnailUrl: item.thumbnail_url,
    angle: item.angle,
    caption: item.caption,
    isPrimary: item.is_primary,
    sortOrder: item.sort_order,
    width: item.width,
    height: item.height,
    durationSeconds: item.duration_seconds
  };
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
