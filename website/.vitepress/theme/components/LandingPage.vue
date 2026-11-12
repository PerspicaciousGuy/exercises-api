<script setup>
/**
 * The home page: a search-first landing page on grid paper.
 *
 * Every exercise name, endpoint and count below is real catalog or API data,
 * so the page cannot promise something the API does not do. The example
 * request and response are the same ones shown in getting-started.md and the
 * joint-stress ratings are those of the Bulgarian Split Squat record.
 *
 * Prices are not decided yet, so every tier shows the PRICE placeholder.
 */

import { computed, onBeforeUnmount, ref, watch } from 'vue';

const REGISTER_URL = 'https://app.harshitbishnoi.dev/register';

/*
 * Live search, backed by GET /public/search on the API. That route needs no key
 * and is built for exactly this: it returns at most 6 slim results and is rate
 * limited, so the catalogue cannot be copied through it. The page never holds
 * the catalogue itself.
 *
 * The box starts with the results for its first query already on screen, so the
 * static build is never empty and nothing is fetched until someone types.
 */
/* Local development talks to a local API; anything else to the live one. */
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.harshitbishnoi.dev');
const SEARCH_PATH = '/public/search';
const START_QUERY = 'split squat';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;
const HTTP_RATE_LIMITED = 429;

const STARTING_ROWS = [
  { name: 'Split Squat', slug: 'split-squat', category: 'strength', difficulty: 'beginner' },
  { name: 'Bulgarian Split Squat', slug: 'bulgarian-split-squat', category: 'strength', difficulty: 'intermediate' },
  { name: 'Smith Machine Split Squat', slug: 'smith-machine-split-squat', category: 'strength', difficulty: 'intermediate' }
];

const query = ref(START_QUERY);
const rows = ref(STARTING_ROWS);
const selected = ref(0);
/* 'ready' | 'idle' | 'loading' | 'busy' | 'error' */
const status = ref('ready');

const answers = new Map();
let timer = null;
let inFlight = null;

const current = computed(() => rows.value[selected.value] ?? null);

const footLabel = computed(() => {
  switch (status.value) {
    case 'idle':
      return `Type at least ${MIN_QUERY_LENGTH} letters`;
    case 'loading':
      return 'Searching…';
    case 'busy':
      return 'Search is busy, try again in a moment';
    case 'error':
      return 'Search is unavailable right now';
    default:
      return rows.value.length === 1 ? '1 result' : `${rows.value.length} results`;
  }
});

const emptyLabel = computed(() => {
  if (status.value === 'idle') return 'Start typing an exercise name.';
  if (status.value === 'busy' || status.value === 'error') return footLabel.value;
  return `Nothing matches “${query.value.trim()}”. Try another name.`;
});

function move(step) {
  if (rows.value.length === 0) {
    return;
  }

  selected.value =
    (selected.value + step + rows.value.length) % rows.value.length;
}

async function search(text) {
  if (answers.has(text)) {
    rows.value = answers.get(text);
    status.value = 'ready';
    return;
  }

  inFlight?.abort();
  inFlight = new AbortController();
  status.value = 'loading';

  try {
    const response = await fetch(
      `${API_BASE}${SEARCH_PATH}?q=${encodeURIComponent(text)}`,
      { signal: inFlight.signal }
    );

    if (response.status === HTTP_RATE_LIMITED) {
      status.value = 'busy';
      rows.value = [];
      return;
    }

    if (!response.ok) {
      throw new Error(`Search failed with ${response.status}`);
    }

    const body = await response.json();
    answers.set(text, body.data);
    rows.value = body.data;
    status.value = 'ready';
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    status.value = 'error';
    rows.value = [];
  }
}

watch(query, (value) => {
  selected.value = 0;
  clearTimeout(timer);

  const text = value.trim();

  if (text.length < MIN_QUERY_LENGTH) {
    inFlight?.abort();
    rows.value = [];
    status.value = 'idle';
    return;
  }

  timer = setTimeout(() => search(text), DEBOUNCE_MS);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  inFlight?.abort();
});

const CATEGORIES = [
  { label: 'Strength', count: 334 },
  { label: 'Flexibility', count: 27 },
  { label: 'Cardio', count: 23 },
  { label: 'Mobility', count: 14 },
  { label: 'Plyometrics', count: 11 }
];

/* stress runs neck, shoulder, elbow, wrist, spine, hip, knee, ankle. */
const WALL = [
  {
    name: 'Bulgarian Split Squat',
    category: 'strength',
    meta: 'Strength · Intermediate',
    stress: ['n', 'n', 'n', 'n', 'l', 'm', 'h', 'm'],
    chips: ['quadriceps', 'glutes'],
    tilt: -0.8
  },
  {
    name: 'Push-up',
    category: 'strength',
    meta: 'Strength · Beginner',
    stress: ['n', 'm', 'm', 'h', 'l', 'l', 'n', 'n'],
    chips: ['chest', 'triceps'],
    tilt: 0.6
  },
  {
    name: 'Pull-up',
    category: 'strength',
    meta: 'Strength · Intermediate',
    stress: ['n', 'h', 'm', 'm', 'n', 'n', 'n', 'n'],
    chips: ['lats', 'biceps'],
    tilt: -0.4
  },
  {
    name: '90/90 Hip Switch',
    category: 'mobility',
    meta: 'Mobility',
    stress: null,
    chips: ['hips', 'bodyweight'],
    tilt: 0.9
  },
  {
    name: 'Plank',
    category: 'strength',
    meta: 'Strength · Beginner',
    stress: ['l', 'm', 'l', 'n', 'm', 'l', 'n', 'n'],
    chips: ['core', 'bodyweight'],
    tilt: 0.5
  },
  {
    name: 'Box Jump',
    category: 'plyometrics',
    meta: 'Plyometrics',
    stress: null,
    chips: ['quadriceps', 'plyo box'],
    tilt: -0.7
  },
  {
    name: 'Rowing Erg',
    category: 'cardio',
    meta: 'Cardio',
    stress: null,
    chips: ['full body', 'rower'],
    tilt: 0.4
  },
  {
    name: 'Standing Hamstring Stretch',
    category: 'flexibility',
    meta: 'Flexibility',
    stress: null,
    chips: ['hamstrings', 'bodyweight'],
    tilt: -0.9
  }
];

const STRESS_LEGEND = [
  { level: 'n', label: 'none' },
  { level: 'l', label: 'low' },
  { level: 'm', label: 'moderate' },
  { level: 'h', label: 'high' }
];

const ASKS = [
  {
    quote: '“My knee hurts.”',
    body: 'Every exercise rates eight joints. Filter on the ones to go easy on, and each high rating names a gentler swap.',
    swap: { from: 'Back Squat', to: 'Belt Squat' },
    tilt: -0.6
  },
  {
    quote: '“That got easy.”',
    body: 'Progressions form a ladder to climb, and regressions let you step back.',
    ladder: [
      { name: 'Wide Push-up', done: true },
      { name: 'Archer Push-up', done: true },
      { name: 'One-Arm Push-up', done: false }
    ],
    tilt: 0.5
  },
  {
    quote: '“I only have dumbbells.”',
    body: '38 kinds of equipment, required or optional on each exercise, so a plan fits whatever is in the room.',
    endpoint: 'GET /exercises/{id}/substitutes?equipment=dumbbell,bench',
    tilt: -0.3
  }
];

const TIERS = [
  { name: 'Free', requests: '1,000', current: true },
  { name: 'Basic', requests: '10,000', current: false },
  { name: 'Pro', requests: '100,000', current: false },
  { name: 'Enterprise', requests: '1,000,000', current: false }
];
</script>

<template>
  <div class="lp">
    <!-- Hero -->
    <section class="lp__hero">
      <div class="lp__wrap">
        <p class="lp__kicker ex-type">
          catalog v15 · 409 exercises · muscles · swaps · progressions
        </p>
        <h1 class="lp__h1">
          Every exercise,<br />
          <span class="ex-highlight">one search</span> away.
        </h1>
        <p class="lp__lede lp__lede--center">
          The muscles, the kit, what to do when a knee complains and what comes
          after it gets easy. Query it live, or sync the whole catalogue into
          your app.
        </p>

        <div class="lp__search-stage">
          <p class="ex-hand lp__note lp__note--left" aria-hidden="true">
            type anything<br />↘
          </p>
          <p class="ex-hand lp__note lp__note--right" aria-hidden="true">
            ← real results,<br />live from the API
          </p>

          <div class="lp__search" role="search">
            <label class="lp__search-input">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <span class="lp__sr">Search the exercise catalogue</span>
              <input
                v-model="query"
                class="lp__search-field"
                type="search"
                placeholder="Try squat, push-up or kettlebell swing"
                autocomplete="off"
                spellcheck="false"
                role="combobox"
                aria-expanded="true"
                aria-controls="lp-results"
                :aria-activedescendant="rows.length ? `lp-result-${selected}` : undefined"
                @keydown.down.prevent="move(1)"
                @keydown.up.prevent="move(-1)"
              />
              <kbd>GET /public/search?q=</kbd>
            </label>

            <ul id="lp-results" class="lp__results" role="listbox" aria-label="Matching exercises">
              <li
                v-for="(row, i) in rows"
                :id="`lp-result-${i}`"
                :key="row.slug"
                class="lp__result"
                :class="{ 'lp__result--on': i === selected }"
                role="option"
                :aria-selected="i === selected"
                @mouseenter="selected = i"
                @click="selected = i"
              >
                <span class="lp__dot" :class="`lp__dot--${row.category}`" aria-hidden="true"></span>
                <span class="lp__result-text">
                  <strong>{{ row.name }}</strong>
                  <span class="lp__muted"> · {{ row.difficulty }}</span>
                </span>
                <span class="lp__chip">{{ row.category }}</span>
              </li>
              <li v-if="!rows.length" class="lp__empty" role="presentation">
                {{ emptyLabel }}
              </li>
            </ul>

            <p class="lp__search-foot ex-type" aria-live="polite">
              <span>{{ footLabel }}</span>
              <span v-if="current" class="lp__search-call">
                GET /exercises/slug/{{ current.slug }}
              </span>
            </p>
          </div>
        </div>

        <div class="lp__actions">
          <a class="lp__button lp__button--primary" :href="REGISTER_URL">
            Get an API key →
          </a>
          <a class="lp__button" href="/getting-started">Read the docs</a>
        </div>
        <p class="lp__fine ex-type">free · 1,000 requests a day · no card</p>
      </div>
    </section>

    <!-- The catalogue wall -->
    <section class="lp__section">
      <div class="lp__wrap">
        <div class="lp__section-head lp__section-head--row">
          <div>
            <p class="lp__eyebrow ex-type">01 · the catalogue</p>
            <h2 class="lp__h2">Pinned up, 409 of them.</h2>
          </div>
          <ul class="lp__chips" aria-label="Exercises by category">
            <li class="lp__chip lp__chip--on">All 409</li>
            <li v-for="c in CATEGORIES" :key="c.label" class="lp__chip">
              {{ c.label }} {{ c.count }}
            </li>
          </ul>
        </div>

        <div class="lp__wall">
          <article
            v-for="ex in WALL"
            :key="ex.name"
            class="lp__ex"
            :style="{ transform: `rotate(${ex.tilt}deg)` }"
          >
            <i class="lp__tape" aria-hidden="true"></i>
            <p class="lp__ex-meta ex-type">
              <span class="lp__dot" :class="`lp__dot--${ex.category}`"></span>
              {{ ex.meta }}
            </p>
            <h3 class="lp__ex-name">{{ ex.name }}</h3>
            <div v-if="ex.stress" class="lp__stress" role="img" aria-label="Joint stress, neck to ankle">
              <i v-for="(level, i) in ex.stress" :key="i" :class="`lp__bar lp__bar--${level}`"></i>
            </div>
            <ul class="lp__ex-chips">
              <li v-for="chip in ex.chips" :key="chip" class="lp__chip">{{ chip }}</li>
            </ul>
          </article>
        </div>

        <p class="lp__legend ex-type">
          <span>joint stress:</span>
          <span v-for="item in STRESS_LEGEND" :key="item.level" class="lp__legend-item">
            <i class="lp__stress lp__stress--key" aria-hidden="true"><i :class="`lp__bar lp__bar--${item.level}`"></i></i>
            {{ item.label }}
          </span>
          <span>· neck, shoulder, elbow, wrist, spine, hip, knee, ankle</span>
        </p>
      </div>
    </section>

    <!-- One request -->
    <section class="lp__section">
      <div class="lp__wrap lp__two">
        <div>
          <p class="lp__eyebrow ex-type">02 · one request</p>
          <h2 class="lp__h2">One call brings the whole index card.</h2>
          <p class="lp__lede">
            Lists return light summaries. Ask for one exercise and the full card
            arrives: instructions, coaching cues, who should avoid it, default
            sets and reps, and links to the rest of the catalogue.
          </p>
        </div>
        <div>
          <article class="lp__card lp__card--taped">
            <i class="lp__tape" aria-hidden="true"></i>
            <p class="lp__ex-meta ex-type">Strength · Intermediate</p>
            <h3 class="lp__card-title">Bulgarian Split Squat</h3>
            <dl class="lp__facts">
              <dt>Primary</dt><dd>Quadriceps, glutes</dd>
              <dt>Kit</dt><dd>Bodyweight, bench (dumbbell optional)</dd>
              <dt>Default</dt><dd>3 sets of 6 to 10, each side</dd>
              <dt>Heads up</dt>
              <dd><span class="ex-highlight">Knee: high.</span> Hip, ankle: moderate.</dd>
            </dl>
          </article>
          <pre class="lp__code"><code><span class="lp__c"># key in a header, never the URL</span>
curl https://api.harshitbishnoi.dev/exercises/slug/bulgarian-split-squat \
  -H <span class="lp__s">"x-api-key: exdb_…"</span>

{ <span class="lp__k">"slug"</span>: "bulgarian-split-squat",
  <span class="lp__k">"jointStress"</span>: { <span class="lp__k">"knee"</span>: <span class="lp__a">"high"</span> },
  <span class="lp__k">"gentlerSwaps"</span>: { <span class="lp__k">"knee"</span>: ["split-squat", "reverse-lunge"] },
  <span class="lp__k">"progressions"</span>: ["pistol-squat", "shrimp-squat"] }</code></pre>
        </div>
      </div>
    </section>

    <!-- Three asks -->
    <section class="lp__section">
      <div class="lp__wrap">
        <p class="lp__eyebrow ex-type">03 · the hard parts, handled</p>
        <h2 class="lp__h2">Three things your users will ask for.</h2>
        <div class="lp__asks">
          <article
            v-for="ask in ASKS"
            :key="ask.quote"
            class="lp__card"
            :style="{ transform: `rotate(${ask.tilt}deg)` }"
          >
            <h3 class="lp__quote ex-hand">{{ ask.quote }}</h3>
            <p>{{ ask.body }}</p>
            <p v-if="ask.swap" class="lp__swap">
              <s>{{ ask.swap.from }}</s> → {{ ask.swap.to }}
            </p>
            <ul v-if="ask.ladder" class="lp__ladder">
              <li v-for="step in ask.ladder" :key="step.name">
                <span class="lp__check" aria-hidden="true">{{ step.done ? '✓' : '' }}</span>
                {{ step.name }}
              </li>
            </ul>
            <p v-if="ask.endpoint" class="lp__endpoint ex-type">{{ ask.endpoint }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Sync -->
    <section class="lp__section">
      <div class="lp__wrap lp__two lp__two--code">
        <div>
          <p class="lp__eyebrow ex-type">04 · offline</p>
          <h2 class="lp__h2">Keep a copy on the phone.</h2>
          <p class="lp__lede">
            Gyms have bad signal. Sync the whole catalogue once, then ask only
            for what changed. Removed exercises arrive as tombstones, so nothing
            lingers.
          </p>
        </div>
        <pre class="lp__code"><code><span class="lp__c"># first sync, 100 at a time</span>
curl 'https://api.harshitbishnoi.dev/sync/exercises?limit=100' \
  -H <span class="lp__s">"x-api-key: exdb_…"</span>

{ "data": { "exercises": [ … ], "tombstones": [],
            "latestChangeAt": "2026-07-02T09:14:00Z" },
  "pagination": { "nextCursor": "eyJvZmZzZXQiOjEwMH0",
                  "hasMore": true } }

<span class="lp__c"># next time</span>
…/sync/exercises?<span class="lp__s">updated_since</span>=2026-07-02T09:14:00Z</code></pre>
      </div>
    </section>

    <!-- Plans -->
    <section id="plans" class="lp__section">
      <div class="lp__wrap">
        <p class="lp__eyebrow ex-type">05 · plans</p>
        <h2 class="lp__h2">Start free. Move up when traffic does.</h2>
        <p class="lp__lede">
          Quotas count per key and reset at midnight UTC. Every response says
          how many are left, and a 429 says when to try again.
        </p>
        <div class="lp__plans">
          <article
            v-for="tier in TIERS"
            :key="tier.name"
            class="lp__stub"
            :class="{ 'lp__stub--current': tier.current }"
          >
            <p class="ex-type">{{ tier.current ? 'Admit · Free' : tier.name }}</p>
            <p class="lp__stub-number">{{ tier.requests }}</p>
            <p class="lp__stub-unit">requests a day</p>
            <p class="lp__stub-price ex-type">[PRICE]</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Closing call to action -->
    <section class="lp__cta">
      <div class="lp__wrap lp__cta-in">
        <div>
          <p class="lp__cta-title ex-hand">Your first request, in two minutes.</p>
          <p class="lp__cta-body">
            Register, copy your key, call an endpoint. The key is shown once, so
            keep it somewhere safe.
          </p>
          <a class="lp__button lp__button--highlight" :href="REGISTER_URL">
            Get an API key →
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lp {
  overflow-x: clip;
  font-family: var(--ex-font-sans);
  font-size: var(--ex-text-lg);
  line-height: var(--ex-leading-normal);
  color: var(--ex-color-text);
}

.lp__wrap {
  position: relative;
  max-width: 77.5rem;
  margin: 0 auto;
  padding: 0 var(--ex-space-5);
}

.lp__muted {
  color: var(--ex-color-text-subtle);
  font-weight: var(--ex-weight-regular);
}

/* ---- type -------------------------------------------------------------- */

.lp__h1 {
  margin: 0;
  text-align: center;
  font-size: clamp(var(--ex-text-4xl), 7vw, var(--ex-text-6xl));
  font-weight: var(--ex-weight-extrabold);
  line-height: var(--ex-leading-none);
  letter-spacing: var(--ex-tracking-display);
  color: var(--ex-color-ink);
}

.lp__h2 {
  max-width: 16em;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: clamp(var(--ex-text-3xl), 4vw, var(--ex-text-4xl));
  font-weight: var(--ex-weight-extrabold);
  line-height: var(--ex-leading-tight);
  letter-spacing: var(--ex-tracking-display);
  color: var(--ex-color-ink);
}

.lp__lede {
  max-width: 36em;
  margin: var(--ex-space-4) 0 0;
  font-size: var(--ex-text-xl);
  color: var(--ex-color-text-muted);
}

.lp__lede--center {
  margin: var(--ex-space-5) auto 0;
  text-align: center;
}

.lp__eyebrow {
  margin: 0 0 var(--ex-space-3);
}

.lp__kicker {
  margin: 0 0 var(--ex-space-4);
  text-align: center;
}

.lp__fine {
  margin: var(--ex-space-4) 0 0;
  text-align: center;
}

/* ---- buttons and chips -------------------------------------------------- */

.lp__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-4);
  justify-content: center;
  margin-top: var(--ex-space-7);
}

.lp__button {
  display: inline-flex;
  align-items: center;
  gap: var(--ex-space-2);
  min-height: 3.25rem;
  padding: 0 var(--ex-space-6);
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-md);
  background: var(--ex-color-surface);
  color: var(--ex-color-ink);
  font-weight: var(--ex-weight-bold);
  text-decoration: none;
  box-shadow: var(--ex-shadow-md);
  transition:
    transform var(--ex-duration-fast) var(--ex-ease-standard),
    box-shadow var(--ex-duration-fast) var(--ex-ease-standard);
}

.lp__button:hover {
  transform: translate(1px, 1px);
  box-shadow: var(--ex-shadow-sm);
}

.lp__button--primary {
  background: var(--ex-color-brand);
  color: var(--ex-color-on-brand);
}

.lp__button--highlight {
  background: var(--ex-color-highlight);
  color: var(--ex-color-on-highlight);
}

.lp__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.lp__chip {
  display: inline-block;
  margin: 0;
  padding: var(--ex-space-1) var(--ex-space-3);
  border: var(--ex-border-width-thin) solid var(--ex-color-border);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-page);
  color: var(--ex-color-text-muted);
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-sm);
  line-height: var(--ex-leading-snug);
}

.lp__chip--on {
  border-color: var(--ex-color-border-ink);
  background: var(--ex-color-brand);
  color: var(--ex-color-on-brand);
}

.lp__dot {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border: 1.5px solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-full);
  background: var(--ex-cat-flexibility);
}
.lp__dot--strength { background: var(--ex-cat-strength); }
.lp__dot--cardio { background: var(--ex-cat-cardio); }
.lp__dot--plyometrics { background: var(--ex-cat-plyometrics); }
.lp__dot--mobility { background: var(--ex-cat-mobility); }
.lp__dot--flexibility { background: var(--ex-cat-flexibility); }

/* ---- hero --------------------------------------------------------------- */

.lp__hero {
  padding: var(--ex-space-9) 0 0;
}

.lp__search-stage {
  position: relative;
  max-width: 49rem;
  margin: var(--ex-space-8) auto 0;
}

.lp__note {
  position: absolute;
  z-index: var(--ex-z-base);
  margin: 0;
  font-size: var(--ex-text-2xl);
  white-space: nowrap;
}
.lp__note--left { left: -8.5rem; top: -3.2rem; transform: rotate(-7deg); }
.lp__note--right { right: -12.5rem; top: 8rem; transform: rotate(5deg); }

.lp__search {
  position: relative;
  overflow: hidden;
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-lg);
  background: var(--ex-color-surface);
  box-shadow: var(--ex-shadow-pop);
  text-align: left;
}

.lp__search-input {
  display: flex;
  align-items: center;
  gap: var(--ex-space-3);
  min-height: 4.5rem;
  padding: 0 var(--ex-space-5);
  border-bottom: var(--ex-border-width) solid var(--ex-color-border-ink);
  font-size: var(--ex-text-xl);
  font-weight: var(--ex-weight-semibold);
  color: var(--ex-color-ink);
}

.lp__search-input kbd {
  margin-left: auto;
  padding: var(--ex-space-1) var(--ex-space-2);
  border: 1.5px solid var(--ex-color-border);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-page);
  color: var(--ex-color-text-subtle);
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-xs);
  font-weight: var(--ex-weight-medium);
}

.lp__search:focus-within {
  outline: 3px solid var(--ex-color-highlight);
  outline-offset: 4px;
}

.lp__search-field {
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;
  caret-color: var(--ex-color-pen);
}

.lp__search-field::placeholder {
  color: var(--ex-color-text-subtle);
  font-weight: var(--ex-weight-regular);
}

/* Visually hidden, still read by screen readers. */
.lp__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.lp__results {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lp__result {
  cursor: pointer;
}

.lp__result-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lp__empty {
  padding: var(--ex-space-5);
  color: var(--ex-color-text-muted);
  font-size: var(--ex-text-base);
}

.lp__search-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-2) var(--ex-space-4);
  justify-content: space-between;
  margin: 0;
  padding: var(--ex-space-3) var(--ex-space-5);
  border-top: var(--ex-border-width) solid var(--ex-color-border-ink);
  background: var(--ex-color-surface-sunken);
}

.lp__search-call {
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-xs);
  letter-spacing: 0;
  text-transform: none;
  color: var(--ex-color-ink);
}

.lp__result {
  display: grid;
  grid-template-columns: 0.875rem 1fr auto;
  gap: var(--ex-space-3);
  align-items: center;
  padding: var(--ex-space-3) var(--ex-space-5);
  border-bottom: var(--ex-border-width-thin) solid var(--ex-color-border);
  font-size: var(--ex-text-base);
}
.lp__result:last-child { border-bottom: 0; }
.lp__result--on { background: var(--ex-color-highlight-soft); }

@media (max-width: 1200px) {
  .lp__note { display: none; }
}

@media (max-width: 560px) {
  .lp__search-input kbd { display: none; }
  .lp__search-input { font-size: var(--ex-text-lg); }
  .lp__lede { font-size: var(--ex-text-lg); }
  .lp__result { grid-template-columns: 0.875rem 1fr; }
  .lp__result .lp__chip { display: none; }
}

/* ---- sections ----------------------------------------------------------- */

.lp__section {
  padding: var(--ex-space-10) 0 0;
}

.lp__section-head--row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-5);
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: var(--ex-space-6);
}

.lp__two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ex-space-8);
  align-items: center;
}
.lp__two--code { grid-template-columns: 5fr 6fr; }

@media (max-width: 960px) {
  .lp__two,
  .lp__two--code { grid-template-columns: 1fr; gap: var(--ex-space-6); }
}

/* ---- wall of cards ------------------------------------------------------ */

.lp__wall {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ex-space-6) var(--ex-space-5);
}

@media (max-width: 1024px) { .lp__wall { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .lp__wall { grid-template-columns: 1fr; } }

.lp__ex {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--ex-space-3);
  min-height: 11.5rem;
  padding: var(--ex-space-5) var(--ex-space-4) var(--ex-space-4);
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-surface);
  box-shadow: var(--ex-shadow-sm);
}

.lp__tape {
  position: absolute;
  top: -0.75rem;
  left: 50%;
  width: 4.75rem;
  height: 1.4rem;
  margin-left: -2.4rem;
  background: var(--ex-color-tape);
  opacity: 0.9;
  transform: rotate(-3deg);
}

.lp__ex-meta {
  display: flex;
  gap: var(--ex-space-2);
  align-items: center;
  margin: 0;
}

.lp__ex-name {
  margin: 0;
  padding: 0;
  font-size: var(--ex-text-xl);
  font-weight: var(--ex-weight-bold);
  line-height: var(--ex-leading-tight);
  letter-spacing: var(--ex-tracking-tight);
  color: var(--ex-color-ink);
}

.lp__ex-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-2);
  margin: auto 0 0;
  padding: 0;
  list-style: none;
}

.lp__stress {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 1.125rem;
}
.lp__stress--key { display: inline-flex; vertical-align: bottom; margin-right: var(--ex-space-2); }

.lp__bar {
  display: block;
  width: 0.5rem;
  border: 1px solid var(--ex-color-border-ink);
  border-radius: 1px;
  background: var(--ex-color-surface-sunken);
}
.lp__bar--n { height: 3px; border-color: var(--ex-color-border-strong); }
.lp__bar--l { height: 7px; }
.lp__bar--m { height: 12px; background: var(--ex-color-highlight); }
.lp__bar--h { height: 18px; background: var(--ex-color-pen); }

.lp__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ex-space-5);
  align-items: center;
  margin: var(--ex-space-6) 0 0;
}
.lp__legend-item { display: inline-flex; align-items: flex-end; }

/* ---- cards, code -------------------------------------------------------- */

.lp__card {
  position: relative;
  padding: var(--ex-space-5);
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-surface);
  box-shadow: var(--ex-shadow-sm);
}
.lp__card p { margin: 0; color: var(--ex-color-text-muted); font-size: var(--ex-text-base); }
.lp__card--taped { margin-bottom: var(--ex-space-5); transform: rotate(1deg); }

.lp__card-title {
  margin: 0;
  padding: 0;
  font-size: var(--ex-text-2xl);
  font-weight: var(--ex-weight-bold);
  letter-spacing: var(--ex-tracking-tight);
  color: var(--ex-color-ink);
}

.lp__facts {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: var(--ex-space-1) var(--ex-space-3);
  margin: var(--ex-space-4) 0 0;
  font-size: var(--ex-text-base);
}
.lp__facts dt {
  padding-top: 3px;
  font-family: var(--ex-font-type);
  font-size: var(--ex-text-sm);
  color: var(--ex-color-text-subtle);
}
.lp__facts dd { margin: 0; }

.lp__code {
  margin: 0;
  padding: var(--ex-space-5);
  overflow-x: auto;
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-code-bg);
  color: var(--ex-color-code-text);
  font-family: var(--ex-font-mono);
  font-size: var(--ex-text-sm);
  line-height: var(--ex-leading-relaxed);
  box-shadow: var(--ex-shadow-lg);
}
.lp__code code { font: inherit; background: none; color: inherit; padding: 0; border: 0; }
.lp__c { color: var(--ex-color-code-muted); }
.lp__k { color: var(--ex-color-code-key); }
.lp__s { color: var(--ex-color-code-string); }
.lp__a { color: var(--ex-color-code-alert); }

/* ---- the three asks ----------------------------------------------------- */

.lp__asks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--ex-space-5);
  margin-top: var(--ex-space-7);
}
@media (max-width: 960px) { .lp__asks { grid-template-columns: 1fr; } }

.lp__quote {
  margin: 0 0 var(--ex-space-3);
  padding: 0;
  border: 0;
  font-size: var(--ex-text-3xl);
  color: var(--ex-color-ink);
}

.lp__swap {
  margin-top: var(--ex-space-4) !important;
  font-weight: var(--ex-weight-bold);
  color: var(--ex-color-ink) !important;
}
.lp__swap s { text-decoration-color: var(--ex-color-pen); text-decoration-thickness: 3px; color: var(--ex-color-text-subtle); }

.lp__ladder { margin: var(--ex-space-4) 0 0; padding: 0; list-style: none; font-weight: var(--ex-weight-bold); color: var(--ex-color-ink); }
.lp__ladder li { display: flex; gap: var(--ex-space-3); align-items: center; padding: var(--ex-space-1) 0; margin: 0; }
.lp__check {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  background: var(--ex-color-surface);
  font-family: var(--ex-font-hand);
  font-size: var(--ex-text-xl);
}

.lp__endpoint { margin: var(--ex-space-4) 0 0 !important; }

/* ---- plans -------------------------------------------------------------- */

.lp__plans {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ex-space-5);
  margin-top: var(--ex-space-7);
}
@media (max-width: 960px) { .lp__plans { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .lp__plans { grid-template-columns: 1fr; } }

.lp__stub {
  display: flex;
  flex-direction: column;
  gap: var(--ex-space-1);
  min-height: 14.5rem;
  padding: var(--ex-space-5) var(--ex-space-5) var(--ex-space-4);
  border: var(--ex-border-width) solid var(--ex-color-border-ink);
  border-radius: var(--ex-radius-sm);
  background: var(--ex-color-surface);
}
.lp__stub p { margin: 0; }
.lp__stub--current { background: var(--ex-color-highlight); color: var(--ex-color-on-highlight); }
.lp__stub--current .ex-type { color: var(--ex-color-on-highlight); }
.lp__stub-number {
  margin-top: var(--ex-space-3) !important;
  font-size: var(--ex-text-4xl);
  font-weight: var(--ex-weight-extrabold);
  line-height: var(--ex-leading-none);
  letter-spacing: var(--ex-tracking-display);
  font-variant-numeric: tabular-nums;
  color: var(--ex-color-ink);
}
.lp__stub--current .lp__stub-number { color: var(--ex-color-on-highlight); }
.lp__stub-unit { font-size: var(--ex-text-base); }
.lp__stub-price { margin-top: auto !important; }

/* ---- closing call to action ---------------------------------------------- */

.lp__cta {
  margin-top: var(--ex-space-10);
  padding: var(--ex-space-9) 0;
  background: var(--ex-color-surface-inverse);
  color: var(--ex-color-text-inverse);
}
.lp__cta-title { margin: 0 0 var(--ex-space-3); font-size: var(--ex-text-5xl); color: var(--ex-color-text-inverse); }
.lp__cta-body { max-width: 32em; margin: 0 0 var(--ex-space-5); color: var(--ex-color-text-inverse); opacity: 0.8; }
</style>
