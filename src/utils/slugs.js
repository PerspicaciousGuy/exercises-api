export function createSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The key two exercise names are compared on: case, spaces, hyphens and other
 * punctuation ignored, so "Push-Up", "push up" and "Pushup" are one name.
 * Names and aliases are unique on this key across the catalog, which is what
 * lets a client resolve a stored name to exactly one exercise.
 */
export function normalizeExerciseName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
