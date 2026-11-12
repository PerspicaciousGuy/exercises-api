<template>
  <header class="page-header">
    <p class="ex-type">404 · page not found</p>
    <h1 class="page-title">That page is not in the book.</h1>
    <p class="page-subtitle">
      The address may have a typo, or the page may have moved.
    </p>
  </header>

  <div class="card">
    <p class="ex-hand not-found__note">try one of these instead</p>
    <div class="row">
      <RouterLink class="button" :to="{ name: 'overview' }">Overview</RouterLink>
      <RouterLink class="button button--ghost" :to="{ name: 'keys' }">
        API keys
      </RouterLink>
      <RouterLink class="button button--ghost" :to="{ name: 'usage' }">
        Usage
      </RouterLink>
    </div>
  </div>
</template>
