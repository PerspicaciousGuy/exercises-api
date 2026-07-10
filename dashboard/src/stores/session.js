import { reactive, readonly } from 'vue';

import { api, ApiError } from '../api/client.js';

const state = reactive({
  user: null,
  isResolved: false
});

/**
 * The session lives in an httpOnly cookie the dashboard cannot read, so
 * "am I logged in?" can only be answered by asking the API. A 401 here is the
 * expected answer for a signed-out visitor, not an error worth surfacing.
 */
async function resolve() {
  try {
    state.user = await api.getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthenticated) {
      state.user = null;
    } else {
      throw error;
    }
  } finally {
    state.isResolved = true;
  }
}

async function login(credentials) {
  const result = await api.login(credentials);
  state.user = result.user;
}

async function register(details) {
  const result = await api.register(details);
  state.user = result.user;
  return result.apiKey;
}

async function logout() {
  await api.logout();
  state.user = null;
}

function setUser(user) {
  state.user = user;
}

export const session = {
  state: readonly(state),
  resolve,
  login,
  register,
  logout,
  setUser
};
