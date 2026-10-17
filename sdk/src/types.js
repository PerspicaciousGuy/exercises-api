// Type definitions for the ExerciseDB SDK, expressed as JSDoc typedefs so the
// package stays plain JavaScript while still shipping .d.ts types generated from
// these. Mirrors the API's OpenAPI contract.

/**
 * @typedef {'draft' | 'active' | 'deprecated'} ExerciseStatus
 * @typedef {'beginner' | 'intermediate' | 'advanced'} Difficulty
 * @typedef {'squat' | 'hinge' | 'push' | 'pull' | 'carry' | 'rotation' | 'gait' | 'core'} MovementPattern
 */

/**
 * The fields needed to render an exercise in a list.
 * @typedef {object} ExerciseSummary
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {ExerciseStatus} status
 * @property {string | null} category - Category slug.
 * @property {Difficulty} difficulty
 * @property {MovementPattern} movementPattern
 * @property {string[]} tags
 * @property {string} updatedAt - ISO 8601 timestamp.
 * @property {boolean} [isPremium]
 */

/**
 * A full exercise record, including coaching and programming data.
 * @typedef {ExerciseSummary & {
 *   description: string,
 *   instructions: string[],
 *   tips: string[],
 *   breathingCues: string | null,
 *   contraindications: string[],
 *   forceType: 'push' | 'pull' | 'static' | 'compound' | null,
 *   mechanics: 'compound' | 'isolation',
 *   position: 'standing' | 'seated' | 'lying' | 'kneeling' | 'other' | null,
 *   planeOfMotion: 'sagittal' | 'frontal' | 'transverse' | 'multi_planar' | null,
 *   jointRegions: string[],
 *   laterality: 'bilateral' | 'unilateral' | 'alternating' | 'single_side' | null,
 *   loadType: 'bodyweight' | 'free_weight' | 'machine' | 'cable' | 'band' | 'cardio_machine' | 'assisted' | 'other' | null,
 *   skillType: 'strength' | 'power' | 'endurance' | 'mobility' | 'balance' | 'coordination' | null,
 *   flags: string[],
 *   programming: Programming,
 *   trackingType: TrackingType | null,
 *   optionalEquipment: string[],
 *   isPremium: boolean,
 *   catalogVersion: number,
 *   primaryMuscles: string[],
 *   secondaryMuscles: string[],
 *   stabilizerMuscles: string[],
 *   equipment: string[],
 *   aliases: string[],
 *   variations: ExerciseRef[],
 *   progressions: ExerciseRef[],
 *   regressions: ExerciseRef[],
 *   media: ExerciseMedia[]
 * }} Exercise
 */

/**
 * Which inputs a logged set takes.
 * @typedef {'weight_reps' | 'reps' | 'assisted_reps' | 'band_reps' | 'duration' | 'weight_duration' | 'distance_duration' | 'weight_distance'} TrackingType
 */

/**
 * Default programming. `defaultReps` is the original text; the other fields
 * are the same values, structured.
 * @typedef {object} Programming
 * @property {number} [defaultSets]
 * @property {string | number} [defaultReps]
 * @property {number} [defaultRepsMin]
 * @property {number} [defaultRepsMax]
 * @property {boolean} perSide - Reps, distance or duration count each side.
 * @property {number} [defaultDistanceMetersMin]
 * @property {number} [defaultDistanceMetersMax]
 * @property {number} [defaultDurationSeconds]
 * @property {number} [defaultDurationMinutes]
 */

/**
 * A link to another exercise; look the full record up by `id`.
 * @typedef {object} ExerciseRef
 * @property {string} id
 * @property {string} slug
 */

/**
 * An image or video attached to an exercise. No exercise has media yet.
 * @typedef {object} ExerciseMedia
 * @property {'image' | 'video' | 'gif' | 'thumbnail'} type
 * @property {string} url
 * @property {string | null} thumbnailUrl
 * @property {string | null} angle
 * @property {string | null} caption - Text alternative.
 * @property {boolean} isPrimary
 * @property {number} sortOrder
 * @property {number | null} width
 * @property {number | null} height
 * @property {number | null} durationSeconds
 */

/**
 * @typedef {object} Pagination
 * @property {number} limit
 * @property {number} offset
 */

/**
 * @typedef {object} ExercisePage
 * @property {ExerciseSummary[]} exercises
 * @property {Pagination} pagination
 */

/**
 * @typedef {object} RelatedExercises
 * @property {ExerciseSummary[]} variations
 * @property {ExerciseSummary[]} progressions
 * @property {ExerciseSummary[]} regressions
 */

/**
 * @typedef {object} ListExercisesParams
 * @property {number} [limit] - 1-100, default 20.
 * @property {number} [offset] - default 0.
 * @property {string} [category] - Category slug.
 * @property {Difficulty} [difficulty]
 * @property {string} [equipment] - Equipment slug; matches required or optional equipment.
 * @property {string} [muscle] - Muscle slug.
 * @property {string} [search] - Name match ignoring case, spaces and hyphens.
 * @property {string} [updatedSince] - ISO 8601; only records updated after this.
 * @property {boolean} [includeDeprecated] - default false.
 * @property {string} [fields] - Comma-separated sparse fieldset.
 */

/**
 * @typedef {object} MuscleCoverageCount
 * @property {string} slug
 * @property {number} count
 */

/**
 * @typedef {object} CoverageBalance
 * @property {MuscleCoverageCount[]} movementPatterns
 * @property {number} pushCount
 * @property {number} pullCount
 * @property {number} primaryMuscleGroupCount
 */

/**
 * @typedef {object} Coverage
 * @property {number} exerciseCount
 * @property {string[]} unknownExerciseIds
 * @property {{ primary: MuscleCoverageCount[], secondary: MuscleCoverageCount[] }} muscles
 * @property {CoverageBalance} balance
 */

/**
 * @typedef {object} Muscle
 * @property {number} id
 * @property {string} slug
 * @property {string} name
 * @property {string} [region]
 * @property {string} [muscleGroup]
 */

/**
 * @typedef {object} Equipment
 * @property {number} id
 * @property {string} slug
 * @property {string} name
 * @property {string} [equipmentGroup]
 */

/**
 * @typedef {object} Category
 * @property {number} id
 * @property {string} slug
 * @property {string} name
 */

/**
 * @typedef {object} CatalogMetadata
 * @property {Muscle[]} muscles
 * @property {Equipment[]} equipment
 * @property {Category[]} categories
 * @property {{ id: number, slug: string, name: string }[]} exerciseFlags
 * @property {{ id: number, slug: string, name: string }[]} jointRegions
 */

export {};
