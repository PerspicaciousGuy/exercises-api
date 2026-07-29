/**
 * Creates an ExerciseDB API client. Every request carries the API key; the
 * `{ success, data }` envelope is unwrapped so methods return `data` directly,
 * and non-2xx responses throw an {@link ExerciseDBError} carrying the API's
 * RFC 9457 problem details.
 *
 * @param {object} options
 * @param {string} options.apiKey - Your ExerciseDB API key.
 * @param {string} [options.baseUrl] - Override the API base URL.
 * @param {typeof fetch} [options.fetch] - Custom fetch (for testing or older runtimes).
 */
export function createClient(options: {
    apiKey: string;
    baseUrl?: string | undefined;
    fetch?: typeof fetch | undefined;
}): {
    exercises: {
        /**
         * List exercises with optional filters. Returns one page.
         * @param {import('./types.js').ListExercisesParams} [params]
         * @returns {Promise<import('./types.js').ExercisePage>}
         */
        list(params?: import("./types.js").ListExercisesParams): Promise<import("./types.js").ExercisePage>;
        /**
         * Iterate every exercise matching the filters, transparently paging.
         * @param {import('./types.js').ListExercisesParams} [params]
         * @returns {AsyncGenerator<import('./types.js').ExerciseSummary>}
         */
        listAll(params?: import("./types.js").ListExercisesParams): AsyncGenerator<import("./types.js").ExerciseSummary>;
        /**
         * @param {string} query
         * @param {{ limit?: number, offset?: number }} [params]
         * @returns {Promise<import('./types.js').ExercisePage>}
         */
        search(query: string, params?: {
            limit?: number;
            offset?: number;
        }): Promise<import("./types.js").ExercisePage>;
        /**
         * @param {string} id
         * @returns {Promise<import('./types.js').Exercise>}
         */
        get(id: string): Promise<import("./types.js").Exercise>;
        /**
         * @param {string} slug
         * @returns {Promise<import('./types.js').Exercise>}
         */
        getBySlug(slug: string): Promise<import("./types.js").Exercise>;
        /**
         * @param {string[]} ids
         * @returns {Promise<import('./types.js').Exercise[]>}
         */
        bulk(ids: string[]): Promise<import("./types.js").Exercise[]>;
        /**
         * @param {string} id
         * @returns {Promise<import('./types.js').RelatedExercises>}
         */
        related(id: string): Promise<import("./types.js").RelatedExercises>;
        /**
         * @param {string} id
         * @returns {Promise<import('./types.js').ExerciseSummary[]>}
         */
        variations(id: string): Promise<import("./types.js").ExerciseSummary[]>;
        /**
         * @param {string} id
         * @returns {Promise<import('./types.js').ExerciseSummary[]>}
         */
        progressions(id: string): Promise<import("./types.js").ExerciseSummary[]>;
        /**
         * @param {string} id
         * @returns {Promise<import('./types.js').ExerciseSummary[]>}
         */
        regressions(id: string): Promise<import("./types.js").ExerciseSummary[]>;
        /**
         * Equipment-aware substitutes: the exercise's variations, optionally kept
         * only if the caller has all their equipment.
         * @param {string} id
         * @param {{ equipment?: string[] }} [options]
         * @returns {Promise<import('./types.js').ExerciseSummary[]>}
         */
        substitutes(id: string, options?: {
            equipment?: string[];
        }): Promise<import("./types.js").ExerciseSummary[]>;
        /**
         * Shortest progression path up to a target exercise, or null if none.
         * @param {string} id
         * @param {string} toId
         * @returns {Promise<import('./types.js').ExerciseSummary[] | null>}
         */
        path(id: string, toId: string): Promise<import("./types.js").ExerciseSummary[] | null>;
    };
    analyze: {
        /**
         * Stateless coverage analysis of a set of exercises.
         * @param {string[]} exerciseIds
         * @returns {Promise<import('./types.js').Coverage>}
         */
        coverage(exerciseIds: string[]): Promise<import("./types.js").Coverage>;
    };
    reference: {
        /** @returns {Promise<import('./types.js').CatalogMetadata>} */
        metadata(): Promise<import("./types.js").CatalogMetadata>;
        /** @returns {Promise<import('./types.js').Muscle[]>} */
        muscles(): Promise<import("./types.js").Muscle[]>;
        /** @returns {Promise<import('./types.js').Equipment[]>} */
        equipment(): Promise<import("./types.js").Equipment[]>;
        /** @returns {Promise<import('./types.js').Category[]>} */
        categories(): Promise<import("./types.js").Category[]>;
        /** @returns {Promise<{ id: number, slug: string, name: string }[]>} */
        exerciseFlags(): Promise<{
            id: number;
            slug: string;
            name: string;
        }[]>;
        /** @returns {Promise<{ id: number, slug: string, name: string }[]>} */
        jointRegions(): Promise<{
            id: number;
            slug: string;
            name: string;
        }[]>;
    };
};
