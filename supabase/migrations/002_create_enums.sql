-- Enumerations used across the public exercise catalog and API account system.

create type public.exercise_status as enum ('draft', 'active', 'deprecated');
create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');
create type public.exercise_category as enum ('strength', 'cardio', 'flexibility', 'plyometrics', 'mobility');
create type public.movement_pattern as enum ('squat', 'hinge', 'push', 'pull', 'carry', 'rotation', 'gait');
create type public.force_type as enum ('push', 'pull', 'static', 'compound');
create type public.mechanics_type as enum ('compound', 'isolation');
create type public.position_type as enum ('standing', 'seated', 'lying', 'kneeling', 'other');
create type public.plane_of_motion_type as enum ('sagittal', 'frontal', 'transverse', 'multi_planar');
create type public.laterality_type as enum ('bilateral', 'unilateral', 'alternating', 'single_side');
create type public.load_type as enum ('bodyweight', 'free_weight', 'machine', 'cable', 'band', 'cardio_machine', 'assisted', 'other');
create type public.skill_type as enum ('strength', 'power', 'endurance', 'mobility', 'balance', 'coordination');
create type public.media_type as enum ('image', 'video', 'gif', 'thumbnail');
create type public.media_status as enum ('draft', 'active', 'archived');
create type public.catalog_change_type as enum ('created', 'updated', 'deprecated', 'deleted');
create type public.subscription_tier as enum ('free', 'basic', 'pro', 'enterprise');
