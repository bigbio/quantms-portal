import { describe, it, expect } from 'vitest'
import {
  APPS, MCP_ENDPOINTS, BUILDS, checkApp, checkMcp, checkSearchIndex, checkCatalogue, buildResult, fetchBuilds, overall, ago,
} from './status.js'

const res = (body, { status = 200, type = 'cors' } = {}) => ({
  ok: status >= 200 && status < 300, status, type, json: async () => body,
})
// fetch answering by URL suffix; anything unlisted fails like a network error.
const fake = (routes) => async (url) => {
  const hit = Object.entries(routes).find(([k]) => url.endsWith(k) || url.includes(k))
  if (!hit) throw new TypeError('Failed to fetch')
  return typeof hit[1] === 'function' ? hit[1](url) : hit[1]
}
const app = APPS[0]
const NOW = Date.parse('2026-11-02T12:00:00Z')

describe('checkApp', () => {
  it('is operational when health and readiness answer', async () => {
    const r = await checkApp(app, fake({ '/health': res({ status: 'ok', data_available: true }), '/ready': res({ ready: true }) }))
    expect(r.state).toBe('up')
  })

  it('is degraded when the process runs without its data', async () => {
    const r = await checkApp(app, fake({ '/health': res({ status: 'ok', index_available: false }), '/ready': res({ ready: true }) }))
    expect(r).toMatchObject({ state: 'degraded', detail: 'running, but its data is not loaded' })
  })

  it('is degraded when readiness fails', async () => {
    const r = await checkApp(app, fake({ '/health': res({ status: 'ok' }), '/ready': res({}, { status: 503 }) }))
    expect(r.state).toBe('degraded')
  })

  it('is down when health errors or nothing answers', async () => {
    expect((await checkApp(app, fake({ '/health': res({}, { status: 502 }) }))).detail).toBe('health check returned HTTP 502')
    expect((await checkApp(app, fake({}))).state).toBe('down')
  })

  it('checks the gateway without a readiness endpoint', async () => {
    const gw = APPS.find((a) => a.id === 'gateway')
    expect((await checkApp(gw, fake({ '/health': res({ status: 'ok' }) }))).state).toBe('up')
  })
})

describe('checkMcp', () => {
  const ep = MCP_ENDPOINTS[2]
  it('is operational when the event stream opens', async () => {
    expect((await checkMcp(ep, fake({ '/mcp': res(null) }))).state).toBe('up')
  })
  it('is down when the endpoint redirects (the broken proxy mount)', async () => {
    const r = await checkMcp(ep, fake({ '/mcp': res(null, { status: 0, type: 'opaqueredirect' }) }))
    expect(r).toMatchObject({ state: 'down', detail: 'redirects instead of answering' })
  })
})

describe('data checks', () => {
  it('reports the search index age and goes stale after a week', async () => {
    const stats = (iso) => fake({ 'stats.json': res({ generated_at: iso, kpis: { proteins: 284437 } }) })
    expect(await checkSearchIndex(stats('2026-11-02T06:00:00Z'), NOW)).toEqual({ state: 'up', detail: 'built 6 h ago · 284,437 proteins' })
    expect((await checkSearchIndex(stats('2026-10-20T06:00:00Z'), NOW)).state).toBe('degraded')
  })
  it('is down when the catalogue is empty', async () => {
    expect((await checkCatalogue(fake({ '/datasets': res({ total: 142 }) }))).detail).toBe('142 datasets')
    expect((await checkCatalogue(fake({ '/datasets': res({ total: 0 }) }))).state).toBe('down')
  })
})

describe('builds', () => {
  const run = (name, conclusion, status = 'completed') => ({
    name, conclusion, status, html_url: `https://github.com/run/${name}`, updated_at: '2026-11-02T10:00:00Z', run_started_at: '2026-11-02T09:55:00Z',
  })

  it('maps a run to a state', () => {
    expect(buildResult(run('x', 'success'), NOW)).toEqual({ state: 'up', detail: 'passed 2 h ago', href: 'https://github.com/run/x' })
    expect(buildResult(run('x', 'failure'), NOW).state).toBe('down')
    expect(buildResult(run('x', null, 'in_progress'), NOW).state).toBe('running')
    expect(buildResult(undefined, NOW).state).toBe('degraded')
  })

  it('asks GitHub once per repository and branch, and caches the answer', async () => {
    const calls = []
    const store = new Map()
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
    const gh = async (url) => {
      calls.push(url)
      return res({ workflow_runs: BUILDS.map((b) => run(b.workflow, 'success')) })
    }
    const out = await fetchBuilds(gh, storage, NOW)
    expect(calls).toHaveLength(new Set(BUILDS.map((b) => `${b.repo}@${b.branch}`)).size)
    expect(out.every((b) => b.result.state === 'up')).toBe(true)
    await fetchBuilds(gh, storage, NOW + 60000)
    expect(calls).toHaveLength(new Set(BUILDS.map((b) => `${b.repo}@${b.branch}`)).size)
  })

  it('says so when GitHub rate-limits, and does not cache that', async () => {
    const store = new Map()
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }
    const out = await fetchBuilds(async () => res({}, { status: 403 }), storage, NOW)
    expect(out[0].result.detail).toBe('GitHub rate limit reached, try later')
    expect(store.size).toBe(0)
  })
})

describe('overall', () => {
  it('summarises the service checks', () => {
    expect(overall([{ state: 'up' }, { state: 'up' }]).title).toBe('All systems operational')
    expect(overall([{ state: 'up' }, { state: 'degraded' }])).toEqual({ state: 'degraded', title: '1 of 2 checks degraded' })
    expect(overall([{ state: 'down' }, { state: 'degraded' }, { state: 'up' }])).toEqual({ state: 'down', title: '2 of 3 checks failing' })
    expect(overall([{ state: 'up' }, undefined]).state).toBe('running')
  })
  it('words ages', () => {
    expect(ago('2026-11-02T11:59:30Z', NOW)).toBe('just now')
    expect(ago('2026-10-30T12:00:00Z', NOW)).toBe('3 days ago')
  })
})
