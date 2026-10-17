export type ExerciseStatus = "draft" | "active" | "deprecated";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type MovementPattern = "squat" | "hinge" | "push" | "pull" | "carry" | "rotation" | "gait" | "core";
/**
 * The fields needed to render an exercise in a list.
 */
export type ExerciseSummary = {
    id: string;
    slug: string;
    name: string;
    status: ExerciseStatus;
    /**
     * - Category slug.
     */
    category: string | null;
    difficulty: Difficulty;
    movementPattern: MovementPattern;
    tags: string[];
    /**
     * - ISO 8601 timestamp.
     */
    updatedAt: string;
    isPremium?: boolean | undefined;
};
/**
 * A full exercise record, including coaching and programming data.
 */
export type Exercise = ExerciseSummary & {
    description: string;
    instructions: string[];
    tips: string[];
    breathingCues: string | null;
    contraindications: string[];
    forceType: "push" | "pull" | "static" | "compound" | null;
    mechanics: "compound" | "isolation";
    position: "standing" | "seated" | "lying" | "kneeling" | "other" | null;
    planeOfMotion: "sagittal" | "frontal" | "transverse" | "multi_planar" | null;
    jointRegions: string[];
    laterality: "bilateral" | "unilateral" | "alternating" | "single_side" | null;
    loadType: "bodyweight" | "free_weight" | "machine" | "cable" | "band" | "cardio_machine" | "assisted" | "other" | null;
    skillType: "strength" | "power" | "endurance" | "mobility" | "balance" | "coordination" | null;
    flags: string[];
    programming: Programming;
    trackingType: TrackingType | null;
    optionalEquipment: string[];
    isPremium: boolean;
    catalogVersion: number;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    stabilizerMuscles: string[];
    equipment: string[];
    aliases: string[];
    variations: ExerciseRef[];
    progressions: ExerciseRef[];
    regressions: ExerciseRef[];
    media: ExerciseMedia[];
};
/**
 * Which inputs a logged set takes.
 */
export type TrackingType = "weight_reps" | "reps" | "assisted_reps" | "band_reps" | "duration" | "weight_duration" | "distance_duration" | "weight_distance";
/**
 * Default programming. `defaultReps` is the original text; the other fields
 * are the same values, structured.
 */
export type Programming = {
    defaultSets?: number | undefined;
    defaultReps?: string | number | undefined;
    defaultRepsMin?: number | undefined;
    defaultRepsMax?: number | undefined;
    /**
     * - Reps, distance or duration count each side.
     */
    perSide: boolean;
    defaultDistanceMetersMin?: number | undefined;
    defaultDistanceMetersMax?: number | undefined;
    defaultDurationSeconds?: number | undefined;
    defaultDurationMinutes?: number | undefined;
};
/**
 * A link to another exercise; look the full record up by `id`.
 */
export type ExerciseRef = {
    id: string;
    slug: string;
};
/**
 * An image or video attached to an exercise. No exercise has media yet.
 */
export type ExerciseMedia = {
    type: "image" | "video" | "gif" | "thumbnail";
    url: string;
    thumbnailUrl: string | null;
    angle: string | null;
    /**
     * - Text alternative.
     */
    caption: string | null;
    isPrimary: boolean;
    sortOrder: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
};
export type Pagination = {
    limit: number;
    offset: number;
};
export type ExercisePage = {
    exercises: ExerciseSummary[];
    pagination: Pagination;
};
export type RelatedExercises = {
    variations: ExerciseSummary[];
    progressions: ExerciseSummary[];
    regressions: ExerciseSummary[];
};
export type ListExercisesParams = {
    /**
     * - 1-100, default 20.
     */
    limit?: number | undefined;
    /**
     * - default 0.
     */
    offset?: number | undefined;
    /**
     * - Category slug.
     */
    category?: string | undefined;
    difficulty?: Difficulty | undefined;
    /**
     * - Equipment slug; matches required or optional equipment.
     */
    equipment?: string | undefined;
    /**
     * - Muscle slug.
     */
    muscle?: string | undefined;
    /**
     * - Name match ignoring case, spaces and hyphens.
     */
    search?: string | undefined;
    /**
     * - ISO 8601; only records updated after this.
     */
    updatedSince?: string | undefined;
    /**
     * - default false.
     */
    includeDeprecated?: boolean | undefined;
    /**
     * - Comma-separated sparse fieldset.
     */
    fields?: string | undefined;
};
export type MuscleCoverageCount = {
    slug: string;
    count: number;
};
export type CoverageBalance = {
    movementPatterns: MuscleCoverageCount[];
    pushCount: number;
    pullCount: number;
    primaryMuscleGroupCount: number;
};
export type Coverage = {
    exerciseCount: number;
    unknownExerciseIds: string[];
    muscles: {
        primary: MuscleCoverageCount[];
        secondary: MuscleCoverageCount[];
    };
    balance: CoverageBalance;
};
export type Muscle = {
    id: number;
    slug: string;
    name: string;
    region?: string | undefined;
    muscleGroup?: string | undefined;
};
export type Equipment = {
    id: number;
    slug: string;
    name: string;
    equipmentGroup?: string | undefined;
};
export type Category = {
    id: number;
    slug: string;
    name: string;
};
export type CatalogMetadata = {
    muscles: Muscle[];
    equipment: Equipment[];
    categories: Category[];
    exerciseFlags: {
        id: number;
        slug: string;
        name: string;
    }[];
    jointRegions: {
        id: number;
        slug: string;
        name: string;
    }[];
};
