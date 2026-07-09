import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies the API's OpenAPI spec into the site's public folder at build time.
 *
 * The spec is never committed here. `docs/openapi.yaml` in the API is the only
 * source of truth; a second copy under version control would drift from the
 * implementation.
 */

const siteRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const SPEC_SOURCE = join(siteRoot, '..', 'docs', 'openapi.yaml');
const PUBLIC_DIR = join(siteRoot, 'public');
const SPEC_DESTINATION = join(PUBLIC_DIR, 'openapi.yaml');

await mkdir(PUBLIC_DIR, { recursive: true });

try {
  await copyFile(SPEC_SOURCE, SPEC_DESTINATION);
  console.info(`Copied openapi.yaml -> ${SPEC_DESTINATION}`);
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error(
      `Cannot find the API spec at ${SPEC_SOURCE}. The docs site must be built from inside the API repository.`
    );
  }

  throw error;
}
