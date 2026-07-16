<script setup>
/**
 * Marketing sections below the VitePress hero. Structured as full-bleed bands
 * with contained content, so the page reads as alternating zones rather than
 * one narrow column of prose.
 *
 * The example response is copied from the OpenAPI `ExerciseSummary` schema and
 * must stay identical to the one in getting-started.md, so the two cannot drift.
 */

const REQUEST = `curl https://api.harshitbishnoi.dev/exercises?limit=1 \\
  -H "x-api-key: exdb_XEtT1o…"`;

const RESPONSE = `{
  "success": true,
  "data": [
    {
      "id": "8c1e5a10-0000-4000-8000-000000000001",
      "slug": "barbell-back-squat",
      "name": "Barbell Back Squat",
      "status": "active",
      "category": "strength",
      "difficulty": "intermediate",
      "movementPattern": "squat",
      "tags": ["compound", "lower-body"],
      "updatedAt": "2026-06-15T10:00:00.000Z"
    }
  ],
  "pagination": { "limit": 1, "offset": 0 }
}`;

const DIFFERENTIATORS = [
  {
    title: 'Relationships, curated by hand',
    body: 'A flat list tells you a barbell back squat exists. It does not tell you that a goblet squat is the regression, a front squat is the variation, and a pause squat is the progression. One request returns all three groups — which is what lets you build a programme that scales with a user instead of a menu they scroll past.',
    endpoint: 'GET /exercises/{id}/related'
  },
  {
    title: 'Sync that tells you what was deleted',
    body: 'A dataset you copy once starts rotting immediately. Sync returns only what changed since last time — and, critically, tombstones for records that were deprecated or removed. Without those, a deleted exercise lingers in your app forever. That is the failure a raw dump cannot warn you about.',
    endpoint: 'GET /sync/exercises'
  },
  {
    title: 'Ids that do not move',
    body: 'Every exercise has a stable UUID and a stable slug. Use the id as your local primary key and it will still resolve next year. Re-scraping a dataset means re-reconciling it, every single time.',
    endpoint: 'GET /exercises/{id}'
  }
];

const TIERS = [
  { name: 'Free', requests: '1,000', note: 'No card required', featured: false },
  { name: 'Basic', requests: '10,000', note: '10× the free quota', featured: false },
  {
    name: 'Pro',
    requests: '100,000',
    note: '100× the free quota',
    featured: true
  },
  {
    name: 'Enterprise',
    requests: '1,000,000',
    note: 'For high-volume sync',
    featured: false
  }
];
</script>

<template>
  <div class="lp">
    <!-- Code demo -->
    <section class="lp__band">
      <div class="lp__inner">
        <div class="lp__head">
          <p class="lp__eyebrow">Quickstart</p>
          <h2 class="lp__title">One request, real data</h2>
          <p class="lp__lede">
            No SDK, no setup. Send your key, get exercises back.
          </p>
        </div>

        <div class="lp__demo">
          <div class="lp__pane">
            <div class="lp__pane-head">Request</div>
            <pre class="lp__code"><code>{{ REQUEST }}</code></pre>
          </div>
          <div class="lp__pane">
            <div class="lp__pane-head">Response</div>
            <pre class="lp__code"><code>{{ RESPONSE }}</code></pre>
          </div>
        </div>

        <p class="lp__note">
          That is a <strong>summary</strong>. Ask for one exercise by id and you
          also get the description, ordered instructions, coaching tips,
          breathing cues, contraindications, mechanics, and programming data.
        </p>
      </div>
    </section>

    <!-- Differentiators -->
    <section class="lp__band lp__band--alt">
      <div class="lp__inner">
        <div class="lp__head">
          <p class="lp__eyebrow">Why ExerciseDB</p>
          <h2 class="lp__title">Why not just scrape a dataset?</h2>
          <p class="lp__lede">
            You can find a list of exercise names anywhere. What you cannot
            easily find is everything around them.
          </p>
        </div>

        <div class="lp__grid">
          <article
            v-for="item in DIFFERENTIATORS"
            :key="item.title"
            class="lp__card"
          >
            <h3 class="lp__card-title">{{ item.title }}</h3>
            <p class="lp__card-body">{{ item.body }}</p>
            <code class="lp__endpoint">{{ item.endpoint }}</code>
          </article>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section class="lp__band">
      <div class="lp__inner">
        <div class="lp__head">
          <p class="lp__eyebrow">Plans</p>
          <h2 class="lp__title">Start free. Scale when you need to.</h2>
          <p class="lp__lede">
            Every tier gets the whole catalog and every endpoint. Paid tiers
            raise the daily quota — that is the only difference.
          </p>
        </div>

        <div class="lp__plans">
          <article
            v-for="tier in TIERS"
            :key="tier.name"
            class="lp__plan"
            :class="{ 'lp__plan--featured': tier.featured }"
          >
            <p v-if="tier.featured" class="lp__plan-flag">Most popular</p>
            <h3 class="lp__plan-name">{{ tier.name }}</h3>
            <p class="lp__plan-metric">
              <span class="lp__plan-number">{{ tier.requests }}</span>
              <span class="lp__plan-unit">requests / day</span>
            </p>
            <p class="lp__plan-note">{{ tier.note }}</p>
          </article>
        </div>

        <p class="lp__note">
          Every account starts on Free — no card, no trial clock. Quotas are
          counted per API key and reset at midnight UTC. Every response carries
          <code>X-RateLimit-Remaining</code>, and a <code>429</code> carries
          <code>Retry-After</code> telling you exactly when to try again.
          Upgrading is not a code change: your tier lives on your key, so the
          same key simply returns more.
        </p>
      </div>
    </section>

    <!-- CTA -->
    <section class="lp__band lp__band--cta">
      <div class="lp__inner lp__inner--narrow">
        <h2 class="lp__title">Start building</h2>
        <p class="lp__lede">
          Create an account, copy your key, and make your first call in about two
          minutes.
        </p>
        <div class="lp__actions">
          <a class="lp__button" href="https://app.harshitbishnoi.dev/register">
            Get an API key
          </a>
          <a class="lp__button lp__button--alt" href="/getting-started">
            Read the quickstart
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* VitePress renders this inside its centred, max-width `.container`. Each band
 * breaks out of it to span the full viewport, so the alternating backgrounds
 * reach the edges instead of leaving the page looking like a narrow column with
 * empty margins. The content inside each band is re-contained by `.lp__inner`. */
/* `overflow-x: clip` (not `hidden` — that would create a scroll container and
 * break `position: sticky` elsewhere) absorbs the sliver the breakout below
 * would otherwise add, so no horizontal scrollbar appears. */
.lp {
  margin-top: var(--ex-space-8);
  overflow-x: clip;
}

.lp__band {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  padding: var(--ex-space-9) var(--ex-space-5);
  border-top: 1px solid var(--ex-color-border);
}

.lp__band--alt {
  background: var(--ex-color-surface-raised);
}

.lp__band--cta {
  background: var(--ex-color-surface-raised);
  text-align: center;
}

.lp__inner {
  max-width: 68rem;
  margin: 0 auto;
}

.lp__inner--narrow {
  max-width: 36rem;
}

/* Section headers */
.lp__head {
  max-width: 40rem;
  margin: 0 auto var(--ex-space-7);
  text-align: center;
}

.lp__eyebrow {
  margin: 0 0 var(--ex-space-2);
  font-size: var(--ex-text-sm);
  font-weight: var(--ex-weight-semibold);
  letter-spacing: var(--ex-tracking-wide);
  text-transform: uppercase;
  color: var(--ex-color-brand);
}

.lp__title {
  margin: 0;
  font-size: var(--ex-text-3xl);
  font-weight: var(--ex-weight-bold);
  line-height: var(--ex-leading-tight);
  letter-spacing: var(--ex-tracking-tight);
  border: none;
}

.lp__lede {
  margin: var(--ex-space-3) 0 0;
  color: var(--ex-color-text-muted);
  font-size: var(--ex-text-lg);
  line-height: var(--ex-leading-snug);
}

.lp__note {
  max-width: 44rem;
  margin: var(--ex-space-6) auto 0;
  text-align: center;
  color: var(--ex-color-text-muted);
  font-size: var(--ex-text-sm);
  line-height: var(--ex-leading-relaxed);
}

/* Code demo — two panes side by side, using the width. */
.lp__demo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
  gap: var(--ex-space-4);
  align-items: start;
}

.lp__pane {
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-lg);
  overflow: hidden;
  background: var(--ex-color-surface);
}

.lp__pane-head {
  padding: var(--ex-space-2) var(--ex-space-4);
  font-size: var(--ex-text-xs);
  font-weight: var(--ex-weight-semibold);
  letter-spacing: var(--ex-tracking-wide);
  text-transform: uppercase;
  color: var(--ex-color-text-subtle);
  background: var(--ex-color-surface-sunken);
  border-bottom: 1px solid var(--ex-color-border);
}

.lp__code {
  margin: 0;
  padding: var(--ex-space-4);
  overflow-x: auto;
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-sm);
  line-height: var(--ex-leading-relaxed);
  color: var(--ex-color-text);
  background: transparent;
}

/* Differentiator cards */
.lp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: var(--ex-space-5);
}

.lp__card {
  display: flex;
  flex-direction: column;
  padding: var(--ex-space-6);
  background: var(--ex-color-surface);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-lg);
}

.lp__card-title {
  margin: 0 0 var(--ex-space-3);
  font-size: var(--ex-text-lg);
  font-weight: var(--ex-weight-semibold);
  line-height: var(--ex-leading-snug);
  border: none;
}

.lp__card-body {
  margin: 0 0 var(--ex-space-5);
  flex: 1;
  color: var(--ex-color-text-muted);
  font-size: var(--ex-text-sm);
  line-height: var(--ex-leading-relaxed);
}

.lp__endpoint {
  align-self: flex-start;
  padding: var(--ex-space-1) var(--ex-space-3);
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-xs);
  color: var(--ex-color-brand);
  background: var(--ex-color-brand-subtle);
  border-radius: var(--ex-radius-full);
}

/* Plans */
.lp__plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  gap: var(--ex-space-4);
  align-items: stretch;
}

.lp__plan {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--ex-space-6) var(--ex-space-5);
  background: var(--ex-color-surface);
  border: 1px solid var(--ex-color-border);
  border-radius: var(--ex-radius-lg);
}

.lp__plan--featured {
  border-color: var(--ex-color-brand);
  box-shadow: var(--ex-shadow-md);
}

.lp__plan-flag {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: var(--ex-space-1) var(--ex-space-3);
  font-size: var(--ex-text-xs);
  font-weight: var(--ex-weight-semibold);
  white-space: nowrap;
  color: var(--ex-color-on-brand);
  background: var(--ex-color-brand);
  border-radius: var(--ex-radius-full);
}

.lp__plan-name {
  margin: 0 0 var(--ex-space-4);
  font-size: var(--ex-text-lg);
  font-weight: var(--ex-weight-semibold);
  border: none;
}

.lp__plan-metric {
  margin: 0 0 var(--ex-space-5);
  padding-bottom: var(--ex-space-5);
  border-bottom: 1px solid var(--ex-color-border);
}

.lp__plan-number {
  display: block;
  font-size: var(--ex-text-2xl);
  font-weight: var(--ex-weight-bold);
  letter-spacing: var(--ex-tracking-tight);
  line-height: var(--ex-leading-tight);
}

.lp__plan-unit {
  display: block;
  margin-top: var(--ex-space-1);
  font-size: var(--ex-text-sm);
  color: var(--ex-color-text-subtle);
}

.lp__plan-note {
  margin: 0;
  font-size: var(--ex-text-sm);
  color: var(--ex-color-text-muted);
}

/* CTA */
.lp__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--ex-space-3);
  margin-top: var(--ex-space-6);
}

.lp__button {
  display: inline-block;
  padding: var(--ex-space-3) var(--ex-space-6);
  font-weight: var(--ex-weight-semibold);
  color: var(--ex-color-on-brand);
  background: var(--ex-color-brand);
  border: 1px solid transparent;
  border-radius: var(--ex-radius-full);
  transition: background var(--ex-duration-base) var(--ex-ease-standard);
}

.lp__button:hover {
  background: var(--ex-color-brand-hover);
  text-decoration: none;
}

.lp__button--alt {
  color: var(--ex-color-text);
  background: transparent;
  border-color: var(--ex-color-border-strong);
}

.lp__button--alt:hover {
  background: var(--ex-color-surface-sunken);
  border-color: var(--ex-color-brand);
}

@media (max-width: 48rem) {
  .lp__band {
    padding: var(--ex-space-7) var(--ex-space-4);
  }

  .lp__title {
    font-size: var(--ex-text-2xl);
  }
}
</style>
