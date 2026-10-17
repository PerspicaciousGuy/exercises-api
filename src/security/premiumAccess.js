import { PREMIUM_ACCESS_TIERS } from '../constants/rateLimits.js';

export function canAccessPremium(request) {
  return PREMIUM_ACCESS_TIERS.has(request.apiConsumer?.user?.tier);
}

export function filterPremiumExercises(exercises, request) {
  if (canAccessPremium(request)) {
    return exercises;
  }

  return exercises.filter((exercise) => !exercise.isPremium);
}
