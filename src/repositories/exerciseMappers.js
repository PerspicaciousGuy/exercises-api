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
  'flags',
  'programming',
  'tags',
  'is_premium',
  'catalog_version',
  'updated_at',
  'categories(slug,name)'
].join(',');

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
    catalogVersion: row.catalog_version
  };
}
