// Live checks behind the /status page. Every check runs in the visitor's browser and
// resolves to { state, detail, ms?, href? }; state is up | degraded | down | running.
import { API_BASE, GATEWAY_BASE, BROWSE_BASE, STATS_PATH, DATASET_SEARCH_BASE, CELL_LINES_BASE } from '../config.js'

export const CHECK_TIMEOUT_MS = 10000
export const SLOW_MS = 3000
// The search index is rebuilt daily; older than this it is reported stale.
export const INDEX_STALE_DAYS = 7
// GitHub allows 60 anonymous requests an hour per visitor.
export const BUILDS_CACHE_MS = 5 * 60 * 1000

export const APPS = [
  { id: 'dataset-search', title: 'Dataset Search', base: `${API_BASE}/dataset-search`, page: '/apps/dataset-search' },
  { id: 'peptide-search', title: 'Peptide & Protein Search', base: `${API_BASE}/peptide-search`, page: '/apps/peptide-search' },
  { id: 'cell-lines', title: 'Cancer Cell Line Proteome', base: CELL_LINES_BASE, page: '/apps/cell-lines' },
  { id: 'qpx-explore', title: 'qpx Dataset Explorer', base: `${API_BASE}/qpx-explore`, page: '/apps/qpx-explore' },
  { id: 'compass', title: 'Proteome Compass', base: `${API_BASE}/compass`, page: '/apps/compass' },
  { id: 'gateway', title: 'Collections & publish API', base: GATEWAY_BASE, readyPath: null },
]

export const MCP_ENDPOINTS = [
  { id: 'gateway', title: 'Collections & datasets', url: `${GATEWAY_BASE}/mcp/` },
  { id: 'dataset-search', title: 'Dataset Search', url: `${API_BASE}/dataset-search/mcp` },
  { id: 'peptide-search', title: 'Peptide & Protein Search', url: `${API_BASE}/peptide-search/mcp` },
  { id: 'qpx-explore', title: 'qpx Dataset Explorer', url: `${API_BASE}/qpx-explore/mcp` },
  { id: 'compass', title: 'Proteome Compass', url: `${API_BASE}/compass/mcp` },
]

// Public repositories only: the browser reads GitHub without a token.
export const BUILDS = [
  { title: 'Portal website', repo: 'quantms-portal', branch: 'main', workflow: 'Deploy Portal to GitHub Pages' },
  { title: 'quantms.org website', repo: 'quantms.org', branch: 'main', workflow: 'Deploy to GitHub Pages' },
  { title: 'qpx (quantms.io) tests', repo: 'quantms.io', branch: 'main', workflow: 'CI' },
  { title: 'qpx Docker image', repo: 'quantms.io', branch: 'main', workflow: 'Publish Docker image' },
  { title: 'pmultiqc tests', repo: 'pmultiqc', branch: 'main', workflow: 'Pytest' },
  // Pipelines are tested on their pull requests: the latest one, open or merged.
  { title: 'quantms: latest pull request', repo: 'quantms', pr: true, workflow: 'nf-core CI' },
  { title: 'quantmsdiann: latest pull request', repo: 'quantmsdiann', pr: true, workflow: 'nf-core CI' },
]

const up = (detail, extra) => ({ state: 'up', detail, ...extra })
const degraded = (detail, extra) => ({ state: 'degraded', detail, ...extra })
const down = (detail, extra) => ({ state: 'down', detail, ...extra })

export function ago(iso, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (s < 90) return 'just now'
  if (s < 5400) return `${Math.round(s / 60)} min ago`
  if (s < 129600) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} days ago`
}

// fetch with a timeout; { res, ms } or { error, ms }.
async function timed(fetchFn, url, init = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  const t0 = performance.now()
  try {
    const res = await fetchFn(url, { ...init, signal: controller.signal })
    return { res, ms: Math.round(performance.now() - t0), controller }
  } catch (e) {
    const ms = Math.round(performance.now() - t0)
    return { error: ms >= CHECK_TIMEOUT_MS - 50 ? 'no answer in 10 s' : 'not reachable', ms }
  } finally {
    clearTimeout(timer)
  }
}

async function json(res) {
  try { return await res.json() } catch { return null }
}

// Health answers when the process runs; readiness and the *_available flags say whether it serves data.
export async function checkApp(app, fetchFn = fetch) {
  const [h, r] = await Promise.all([
    timed(fetchFn, `${app.base}/health`),
    app.readyPath === null ? null : timed(fetchFn, `${app.base}${app.readyPath || '/ready'}`),
  ])
  if (h.error) return down(h.error)
  if (!h.res.ok) return down(`health check returned HTTP ${h.res.status}`)
  const health = (await json(h.res)) || {}
  const missing = Object.keys(health).filter((k) => k.endsWith('_available') && health[k] === false)
  if (missing.length) return degraded('running, but its data is not loaded', { ms: h.ms })
  if (r) {
    if (r.error || !r.res.ok) return degraded('running, but not ready to serve', { ms: h.ms })
    const ready = (await json(r.res)) || {}
    if (ready.ready === false || (ready.status && !['ready', 'ok'].includes(ready.status))) {
      return degraded('running, still loading its data', { ms: h.ms })
    }
  }
  if (h.ms > SLOW_MS) return degraded(`slow: ${(h.ms / 1000).toFixed(1)} s`, { ms: h.ms })
  return up(`${h.ms} ms`, { ms: h.ms })
}

// A served MCP endpoint opens its event stream (closed at once); a broken mount redirects.
export async function checkMcp(endpoint, fetchFn = fetch) {
  const t = await timed(fetchFn, endpoint.url, { headers: { Accept: 'text/event-stream' }, redirect: 'manual' })
  if (t.error) return down(t.error)
  t.controller.abort()
  if (t.res.type === 'opaqueredirect' || (t.res.status >= 300 && t.res.status < 400)) {
    return down('redirects instead of answering')
  }
  if (!t.res.ok) return down(`HTTP ${t.res.status}`)
  return up(`${t.ms} ms`, { ms: t.ms })
}

export async function checkSearchIndex(fetchFn = fetch, now = Date.now()) {
  const t = await timed(fetchFn, `${BROWSE_BASE}${STATS_PATH}`)
  if (t.error) return down(t.error)
  if (!t.res.ok) return down(`HTTP ${t.res.status}`)
  const s = await json(t.res)
  if (!s?.generated_at) return down('statistics file is unreadable')
  const detail = `built ${ago(s.generated_at, now)} · ${(s.kpis?.proteins ?? 0).toLocaleString('en-US')} proteins`
  const days = (now - new Date(s.generated_at).getTime()) / 86400000
  return days > INDEX_STALE_DAYS ? degraded(`stale: ${detail}`) : up(detail)
}

export async function checkCatalogue(fetchFn = fetch) {
  const t = await timed(fetchFn, `${DATASET_SEARCH_BASE}/datasets?page_size=1`)
  if (t.error) return down(t.error)
  if (!t.res.ok) return down(`HTTP ${t.res.status}`)
  const total = (await json(t.res))?.total
  if (!total) return down('the catalogue lists no datasets')
  return up(`${total.toLocaleString('en-US')} datasets`)
}

export async function checkCollections(fetchFn = fetch) {
  const t = await timed(fetchFn, `${DATASET_SEARCH_BASE}/collections`)
  if (t.error) return down(t.error)
  if (!t.res.ok) return down(`HTTP ${t.res.status}`)
  const cols = ((await json(t.res))?.collections || []).filter((c) => c.dataset_count > 0)
  if (!cols.length) return down('no collection has datasets')
  return up(cols.map((c) => `${c.title || c.name} ${c.dataset_count}`).join(' · '))
}

export async function checkCellLineAtlas(fetchFn = fetch, now = Date.now()) {
  const t = await timed(fetchFn, `${CELL_LINES_BASE}/ready`)
  if (t.error) return down(t.error)
  if (!t.res.ok) return down(`HTTP ${t.res.status}`)
  const r = (await json(t.res)) || {}
  if (!r.atlas) return degraded('atlas not loaded')
  return up(`atlas ${r.atlas}${r.built ? `, built ${ago(r.built, now)}` : ''}`)
}

export const DATA_CHECKS = [
  { id: 'index', title: 'Peptide & protein search index', run: checkSearchIndex },
  { id: 'catalogue', title: 'Dataset catalogue', run: checkCatalogue },
  { id: 'collections', title: 'Collections', run: checkCollections },
  { id: 'cell-lines', title: 'Cell line atlas', run: checkCellLineAtlas },
]

// Latest run of each build's workflow on its branch: one GitHub request per repository.
export function buildResult(run, now = Date.now()) {
  if (!run) return degraded('no run found', {})
  const when = ago(run.updated_at || run.run_started_at, now)
  const extra = { href: run.html_url }
  if (run.status !== 'completed') return { state: 'running', detail: `running, started ${ago(run.run_started_at, now)}`, ...extra }
  if (run.conclusion === 'success') return up(`passed ${when}`, extra)
  if (run.conclusion === 'action_required') return degraded(`waiting for approval to run, ${when}`, extra)
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return down(`failed ${when}`, extra)
  return degraded(`${run.conclusion || 'unknown'} ${when}`, extra)
}

// The run that speaks for a pull request: its newest one that was not cancelled by a later push.
export function prRun(runs, workflow) {
  const mine = runs.filter((r) => r.name === workflow)
  return mine.find((r) => r.conclusion !== 'cancelled') || mine[0]
}

export function prResult(pr, run, now = Date.now()) {
  const title = pr.title.length > 60 ? `${pr.title.slice(0, 57)}…` : pr.title
  const r = buildResult(run, now)
  return { ...r, detail: `#${pr.number} ${title}: ${run ? r.detail : 'no test run'}`, href: run?.html_url || pr.html_url }
}

export async function fetchBuilds(fetchFn = fetch, storage = globalThis.sessionStorage, now = Date.now()) {
  const key = 'quantms-status-builds'
  try {
    const cached = JSON.parse(storage?.getItem(key) || 'null')
    if (cached && now - cached.at < BUILDS_CACHE_MS) return cached.results
  } catch { /* no cache */ }
  let limited = false
  async function gh(path) {
    const t = await timed(fetchFn, `https://api.github.com/repos/bigbio/${path}`)
    if (t.error || !t.res.ok) {
      if (t.res?.status === 403 || t.res?.status === 429) limited = true
      return null
    }
    return json(t.res)
  }
  const failed = () => degraded(limited ? 'GitHub rate limit reached, try later' : 'GitHub not reachable')

  // One request per repository and branch, shared by its workflows.
  const branchRuns = {}
  for (const b of BUILDS.filter((x) => !x.pr)) {
    const k = `${b.repo}@${b.branch}`
    branchRuns[k] ??= gh(`${b.repo}/actions/runs?branch=${b.branch}&per_page=50&exclude_pull_requests=true`)
  }
  const results = await Promise.all(BUILDS.map(async (b) => {
    if (!b.pr) {
      const data = await branchRuns[`${b.repo}@${b.branch}`]
      return { ...b, result: data ? buildResult(data.workflow_runs?.find((r) => r.name === b.workflow), now) : failed() }
    }
    const pulls = await gh(`${b.repo}/pulls?state=all&sort=updated&direction=desc&per_page=1`)
    const pr = pulls?.[0]
    if (!pr) return { ...b, result: pulls ? degraded('no pull requests') : failed() }
    const data = await gh(`${b.repo}/actions/runs?head_sha=${pr.head.sha}&per_page=20`)
    return { ...b, result: data ? prResult(pr, prRun(data.workflow_runs || [], b.workflow), now) : failed() }
  }))
  if (!limited) {
    try { storage?.setItem(key, JSON.stringify({ at: now, results })) } catch { /* private mode */ }
  }
  return results
}

// The banner over the service checks (builds are reported, not counted as outages).
export function overall(results) {
  const states = results.map((r) => r?.state)
  if (states.some((s) => !s)) return { state: 'running', title: 'Checking…' }
  const nDown = states.filter((s) => s === 'down').length
  const nDeg = states.filter((s) => s === 'degraded').length
  if (!nDown && !nDeg) return { state: 'up', title: 'All systems operational' }
  const n = nDown + nDeg
  return {
    state: nDown ? 'down' : 'degraded',
    title: `${n} of ${states.length} checks ${nDown ? 'failing' : 'degraded'}`,
  }
}
