<template>
  <DocsLayout
    :current="slug"
    :toc="toc"
    :active-heading="activeHeading"
    @toc-click="scrollToHeading"
  >
    <article
      v-if="html"
      ref="contentEl"
      class="docs-prose"
      v-html="html"
      @click="onContentClick"
    ></article>

    <div v-else class="docs-notfound">
      <h1>Page not found</h1>
      <p>
        There is no documentation page called <code>{{ slug }}</code>.
        Head back to the <router-link to="/docs">documentation home</router-link>.
      </p>
    </div>
  </DocsLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import DocsLayout from '../components/DocsLayout.vue'
import { DOCS_DEFAULT } from '../docs/nav.js'

// Eagerly load every docs Markdown file as a raw string. Keyed by file path.
const rawFiles = import.meta.glob('../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// slug -> markdown source
const docsBySlug = {}
for (const [path, src] of Object.entries(rawFiles)) {
  const slug = path.split('/').pop().replace(/\.md$/, '')
  docsBySlug[slug] = src
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })

// Open external (http/https) links in a new tab; leave internal links to the
// SPA click handler.
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const href = tokens[idx].attrGet('href') || ''
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank')
    tokens[idx].attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const route = useRoute()
const router = useRouter()

const slug = computed(() => route.params.page || DOCS_DEFAULT)

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Render markdown -> { html, toc }, adding stable ids to h2/h3 headings.
function renderDoc(src) {
  const tokens = md.parse(src, {})
  const toc = []
  const used = {}
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'heading_open' && (t.tag === 'h2' || t.tag === 'h3')) {
      const text = tokens[i + 1] ? tokens[i + 1].content : ''
      let id = slugify(text) || 'section'
      if (used[id]) id = `${id}-${(used[id] += 1)}`
      else used[id] = 1
      t.attrSet('id', id)
      toc.push({ id, text, level: Number(t.tag.slice(1)) })
    }
  }
  return { html: md.renderer.render(tokens, md.options, {}), toc }
}

const html = ref('')
const toc = ref([])
const activeHeading = ref('')
const contentEl = ref(null)

function load() {
  const src = docsBySlug[slug.value]
  if (!src) {
    html.value = ''
    toc.value = []
    return
  }
  const out = renderDoc(src)
  html.value = out.html
  toc.value = out.toc
  activeHeading.value = out.toc.length ? out.toc[0].id : ''
  nextTick(() => {
    window.scrollTo({ top: 0 })
    updateActiveHeading()
  })
}

watch(slug, load, { immediate: true })

// ── SPA navigation for internal links inside rendered markdown ──
function onContentClick(e) {
  const a = e.target.closest('a')
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (href.startsWith('#')) {
    e.preventDefault()
    scrollToHeading(href.slice(1))
    return
  }
  // Internal, same-app links: use the router instead of a full reload.
  if (href.startsWith('/') && a.target !== '_blank') {
    e.preventDefault()
    router.push(href)
  }
}

function scrollToHeading(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeHeading.value = id
  }
}

// ── Scrollspy: highlight the heading currently in view ──
function updateActiveHeading() {
  if (!toc.value.length) return
  const offset = 120 // account for the fixed navbar
  let current = toc.value[0].id
  for (const h of toc.value) {
    const el = document.getElementById(h.id)
    if (el && el.getBoundingClientRect().top - offset <= 0) {
      current = h.id
    }
  }
  activeHeading.value = current
}

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  window.requestAnimationFrame(() => {
    updateActiveHeading()
    ticking = false
  })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.docs-notfound {
  padding: 40px 0 80px;
}
.docs-notfound h1 {
  font-size: 28px;
  font-weight: 800;
  margin-bottom: 12px;
}
.docs-notfound p {
  color: var(--text-secondary);
}
.docs-notfound a {
  color: var(--indigo);
  font-weight: 600;
  text-decoration: none;
}

/* ── Prose typography (scoped, but :deep for v-html content) ── */
.docs-prose {
  max-width: 760px;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--text-primary);
}
.docs-prose :deep(h1) {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  margin: 0 0 20px;
}
.docs-prose :deep(h2) {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 44px 0 14px;
  padding-top: 8px;
  scroll-margin-top: 80px;
}
.docs-prose :deep(h3) {
  font-size: 17px;
  font-weight: 700;
  margin: 30px 0 10px;
  scroll-margin-top: 80px;
}
.docs-prose :deep(p) {
  margin: 0 0 16px;
  color: var(--text-primary);
}
.docs-prose :deep(a) {
  color: var(--indigo);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid rgba(99, 102, 241, 0.25);
}
.docs-prose :deep(a:hover) {
  border-bottom-color: var(--indigo);
}
.docs-prose :deep(ul),
.docs-prose :deep(ol) {
  margin: 0 0 16px;
  padding-left: 24px;
}
.docs-prose :deep(li) {
  margin-bottom: 8px;
}
.docs-prose :deep(li)::marker {
  color: var(--text-muted);
}
.docs-prose :deep(strong) {
  font-weight: 700;
  color: var(--text-primary);
}
.docs-prose :deep(code) {
  font-family: var(--mono);
  font-size: 0.86em;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 6px;
  color: var(--violet);
}
.docs-prose :deep(pre) {
  background: #0f172a;
  border-radius: 8px;
  padding: 16px 20px;
  overflow-x: auto;
  margin: 0 0 20px;
  line-height: 1.6;
}
.docs-prose :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  color: #e2e8f0;
  font-size: 13px;
}
.docs-prose :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 16px;
  color: var(--text-secondary);
  margin: 0 0 16px;
}
.docs-prose :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 32px 0;
}
.docs-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 0 0 20px;
}
.docs-prose :deep(th),
.docs-prose :deep(td) {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.docs-prose :deep(th) {
  color: var(--text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
}
</style>
