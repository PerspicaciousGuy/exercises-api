/**
 * Regenerates the Postman collection from docs/openapi.yaml.
 *
 * The converter emits an `{{apiKey}}` reference in the collection's auth block
 * but never declares the variable, so it would not appear in Postman's variable
 * editor. This declares it after conversion. Run via `npm run postman:generate`.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SPEC_PATH = 'docs/openapi.yaml';
const OUTPUT_PATH = 'postman/exercisedb-api.postman_collection.json';
const CONVERTER = 'openapi-to-postmanv2';
const DEFAULT_BASE_URL = 'https://api.harshitbishnoi.dev';

const COLLECTION_VARIABLES = [
  { key: 'baseUrl', value: DEFAULT_BASE_URL, type: 'string' },
  { key: 'apiKey', value: '', type: 'string' }
];

const CONVERTER_OPTIONS =
  'folderStrategy=Tags,requestParametersResolution=Example';

function convert() {
  // A fixed command string, not an argument array: `npx` resolves to `npx.cmd`
  // on Windows, which Node refuses to spawn without a shell. Every value here
  // is a module constant, so there is nothing to escape.
  execSync(
    `npx -y ${CONVERTER} -s ${SPEC_PATH} -o ${OUTPUT_PATH} -p -O ${CONVERTER_OPTIONS}`,
    { stdio: 'inherit' }
  );
}

function declareVariables() {
  const collection = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
  collection.variable = COLLECTION_VARIABLES;
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(collection, null, 2)}\n`);

  return countRequests(collection.item);
}

function countRequests(items) {
  return items.reduce(
    (total, item) => total + (item.item ? countRequests(item.item) : 1),
    0
  );
}

convert();
console.info(`Collection written with ${declareVariables()} requests.`);
