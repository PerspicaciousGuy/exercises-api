import { parseCatalogExport } from '../validation/catalogExport.js';

/**
 * Builds the bundle a mobile app ships as its starting catalog: every active
 * exercise as a full record, plus the reference lists, plus the sync watermark
 * the app's first `/sync/exercises?updated_since=` call continues from.
 *
 * Output is deterministic for a given database state: exercises sorted by
 * slug, reference rows by display order, keys always in the same order. Only
 * `exportedAt` moves between two runs over unchanged data.
 */
export async function buildCatalogExport({
  syncRepository,
  referenceRepository,
  now = () => new Date()
}) {
  // Read the watermark before the exercises, as sync does: a change written
  // mid-export then carries a later timestamp and arrives on the first sync.
  const { catalogVersion, latestChangeAt } =
    await syncRepository.getSyncMetadata();
  const [exercises, metadata] = await Promise.all([
    syncRepository.listActiveExercises(),
    referenceRepository.getMetadata()
  ]);

  return parseCatalogExport({
    catalogVersion,
    exportedAt: now().toISOString(),
    latestChangeAt,
    muscles: sortReferences(metadata.muscles),
    equipment: sortReferences(metadata.equipment),
    categories: sortReferences(metadata.categories),
    exerciseFlags: sortReferences(metadata.exerciseFlags),
    jointRegions: sortReferences(metadata.jointRegions),
    enums: metadata.enums,
    exercises: [...exercises].sort((a, b) => compare(a.slug, b.slug))
  });
}

function sortReferences(rows) {
  return [...rows].sort(
    (a, b) => a.displayOrder - b.displayOrder || compare(a.slug, b.slug)
  );
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
