<template>
  <section class="page-head">
    <div class="container">
      <h1>Status</h1>
      <p>Live state of the portal's applications, data, AI-agent endpoints and builds, checked from your browser.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="st-banner" :class="`st-${banner.state}`" role="status">
        <span class="st-icon" aria-hidden="true">{{ ICON[banner.state] }}</span>
        <strong>{{ banner.title }}</strong>
        <span class="st-checked">
          <template v-if="checkedAt">Checked {{ checkedAt }}</template>
          <button type="button" class="btn btn-outline st-again" :disabled="checking" @click="runChecks">Check again</button>
        </span>
      </div>

      <div v-for="g in groups" :key="g.id" class="st-group">
        <h2 class="rule-title">{{ g.title }}</h2>
        <p v-if="g.note" class="section-lede">{{ g.note }}</p>
        <ul class="st-list">
          <li v-for="row in g.rows" :key="row.key" class="st-row">
            <span class="st-name">
              <router-link v-if="row.page" :to="row.page">{{ row.title }}</router-link>
              <template v-else>{{ row.title }}</template>
            </span>
            <span class="st-detail">
              <a v-if="row.result?.href" :href="row.result.href" target="_blank" rel="noopener">{{ row.result.detail }}</a>
              <template v-else>{{ row.result?.detail || 'checking…' }}</template>
            </span>
            <span class="st-state" :class="`st-${row.result?.state || 'running'}`">
              <span class="st-icon" aria-hidden="true">{{ ICON[row.result?.state || 'running'] }}</span>
              {{ LABEL[row.result?.state || 'running'] }}
            </span>
          </li>
        </ul>
      </div>

      <p class="table-note">
        Each check runs in your browser when the page opens and every minute after, so a problem on your own
        network shows here too. Builds are the latest GitHub Actions run on each repository's main or dev branch,
        refreshed every 15 minutes; a failing build does not count as an outage.
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { APPS, MCP_ENDPOINTS, DATA_CHECKS, checkApp, checkMcp, fetchBuilds, overall } from '../utils/status.js'

const ICON = { up: '✓', degraded: '!', down: '✕', running: '…' }
const LABEL = { up: 'Operational', degraded: 'Degraded', down: 'Down', running: 'Checking' }
const REFRESH_MS = 60000

const results = reactive({})
const builds = ref(null)
const checking = ref(false)
const checkedAt = ref('')

const groups = computed(() => [
  {
    id: 'apps',
    title: 'Applications',
    rows: APPS.map((a) => ({ key: `app:${a.id}`, title: a.title, page: a.page, result: results[`app:${a.id}`] })),
  },
  {
    id: 'data',
    title: 'Data',
    rows: DATA_CHECKS.map((d) => ({ key: `data:${d.id}`, title: d.title, result: results[`data:${d.id}`] })),
  },
  {
    id: 'mcp',
    title: 'AI agents (MCP)',
    note: 'The endpoints AI assistants connect to; see the API & MCP docs to add one.',
    rows: MCP_ENDPOINTS.map((m) => ({ key: `mcp:${m.id}`, title: m.title, result: results[`mcp:${m.id}`] })),
  },
  {
    id: 'builds',
    title: 'Builds',
    rows: (builds.value || []).map((b) => ({ key: `build:${b.repo}:${b.workflow}`, title: b.title, result: b.result })),
  },
])

const serviceKeys = [...APPS.map((a) => `app:${a.id}`), ...DATA_CHECKS.map((d) => `data:${d.id}`), ...MCP_ENDPOINTS.map((m) => `mcp:${m.id}`)]
const banner = computed(() => overall(serviceKeys.map((k) => results[k])))

async function runChecks() {
  if (checking.value) return
  checking.value = true
  const jobs = [
    ...APPS.map((a) => [`app:${a.id}`, () => checkApp(a)]),
    ...DATA_CHECKS.map((d) => [`data:${d.id}`, () => d.run()]),
    ...MCP_ENDPOINTS.map((m) => [`mcp:${m.id}`, () => checkMcp(m)]),
  ]
  await Promise.all([
    ...jobs.map(async ([key, run]) => {
      try { results[key] = await run() } catch { results[key] = { state: 'down', detail: 'check failed' } }
    }),
    fetchBuilds().then((b) => { builds.value = b }, () => {}),
  ])
  checkedAt.value = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  checking.value = false
}

let timer = null
onMounted(() => {
  runChecks()
  timer = setInterval(runChecks, REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.st-up { --st: #1a7f37; }
.st-degraded { --st: #9a6700; }
.st-down { --st: #cf222e; }
.st-running { --st: var(--text-muted); }

.st-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 16px 20px;
  margin-bottom: 36px;
  border: 1px solid var(--st);
  border-left-width: 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--st) 8%, var(--surface));
  font-size: 18px;
}
.st-banner .st-icon {
  color: var(--st);
  font-weight: 700;
}
.st-checked {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}
.st-again {
  font-size: 14px;
  padding: 5px 12px;
}
.st-group {
  margin-bottom: 36px;
}
.st-list {
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}
.st-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr) 130px;
  gap: 4px 16px;
  align-items: center;
  padding: 12px 16px;
}
.st-row + .st-row {
  border-top: 1px solid var(--border-subtle);
}
.st-name {
  font-weight: 500;
}
.st-name a {
  color: var(--text-primary);
}
.st-detail {
  font-size: 14px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}
.st-detail a {
  color: var(--brand);
}
.st-state {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--st);
}
.st-state .st-icon {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--st);
  color: #fff;
  font-size: 11px;
}
@media (max-width: 640px) {
  .st-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .st-detail {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .st-checked {
    margin-left: 0;
  }
}
</style>
