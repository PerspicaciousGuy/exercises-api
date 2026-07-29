// Removes previously emitted .d.ts files so `tsc` can regenerate them — tsc
// refuses to overwrite files it also sees as inputs when emitting in place.
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdkRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

rmSync(join(sdkRoot, 'index.d.ts'), { force: true });
for (const file of readdirSync(join(sdkRoot, 'src'))) {
  if (file.endsWith('.d.ts')) {
    rmSync(join(sdkRoot, 'src', file));
  }
}
