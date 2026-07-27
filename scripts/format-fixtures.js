import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Formats the catalog fixture JSON to the project's compact house style:
 * objects are expanded (one key per line, 2-space indent), but arrays whose
 * elements are all scalars stay inline on one line. Prettier cannot express
 * this — it always expands arrays past its print width — so the fixtures live
 * outside Prettier (see .prettierignore) and this script owns their shape.
 *
 * Run after any batch whose links were applied by a script (those default to
 * fully-expanded JSON.stringify output). Idempotent.
 */

const FIXTURE_DIRS = ['data/exercises', 'data/reference'];
const INDENT = '  ';

const isScalar = (value) => value === null || typeof value !== 'object';
const allScalars = (array) => array.every(isScalar);

function format(value, depth) {
  const pad = INDENT.repeat(depth);
  const padInner = INDENT.repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (allScalars(value)) {
      return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
    }
    const items = value.map((item) => padInner + format(item, depth + 1));
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const entries = keys.map(
      (key) => `${padInner}${JSON.stringify(key)}: ${format(value[key], depth + 1)}`
    );
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }

  return JSON.stringify(value);
}

let changed = 0;
for (const dir of FIXTURE_DIRS) {
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const path = join(dir, file);
    const before = readFileSync(path, 'utf8');
    const after = format(JSON.parse(before), 0) + '\n';
    if (after !== before) {
      writeFileSync(path, after);
      changed += 1;
      console.info(`formatted ${path}`);
    }
  }
}
console.info(changed ? `Formatted ${changed} file(s).` : 'All fixtures already compact.');
