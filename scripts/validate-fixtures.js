import { loadCatalogFixtures } from '../src/import/catalogFixtureFiles.js';

const fixtures = await loadCatalogFixtures();

console.info(
  `Validated ${fixtures.references.muscles.length} muscles, ` +
    `${fixtures.references.equipment.length} equipment records, ` +
    `${fixtures.references.categories.length} categories, ` +
    `${fixtures.references.exerciseFlags.length} exercise flags, ` +
    `${fixtures.references.jointRegions.length} joint regions, and ` +
    `${fixtures.exercises.length} sample exercises.`
);
