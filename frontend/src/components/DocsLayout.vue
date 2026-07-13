<template>
  <div class="docs-shell">
    <!-- Mobile top bar: toggles the sidebar -->
    <div class="docs-mobilebar">
      <button class="docs-menu-btn" type="button" @click="sidebarOpen = !sidebarOpen">
        <span class="docs-menu-icon">☰</span> Documentation
      </button>
    </div>

    <div class="docs-grid">
      <!-- Left sidebar -->
      <aside class="docs-sidebar" :class="{ open: sidebarOpen }">
        <nav class="docs-nav" aria-label="Documentation">
          <router-link to="/docs" class="docs-nav-home" @click="sidebarOpen = false">
            quantms Portal Docs
          </router-link>
          <div v-for="section in nav" :key="section.group" class="docs-nav-group">
            <div class="docs-nav-grouptitle">{{ section.group }}</div>
            <router-link
              v-for="item in section.items"
              :key="item.slug"
              :to="`/docs/${item.slug}`"
              class="docs-nav-link"
              :class="{ active: item.slug === current }"
              @click="sidebarOpen = false"
            >
              {{ item.title }}
            </router-link>
          </div>
        </nav>
      </aside>

      <!-- Scrim behind the mobile drawer -->
      <div v-if="sidebarOpen" class="docs-scrim" @click="sidebarOpen = false"></div>

      <!-- Content column -->
      <main class="docs-content">
        <slot />
      </main>

      <!-- Right in-page table of contents -->
      <aside class="docs-toc" v-if="toc && toc.length">
        <div class="docs-toc-title">On this page</div>
        <a
          v-for="h in toc"
          :key="h.id"
          :href="`#${h.id}`"
          class="docs-toc-link"
          :class="[`lvl-${h.level}`, { active: h.id === activeHeading }]"
          @click.prevent="onTocClick(h.id)"
        >{{ h.text }}</a>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { DOCS_NAV } from '../docs/nav.js'

const props = defineProps({
  current: { type: String, default: '' },
  toc: { type: Array, default: () => [] },
  activeHeading: { type: String, default: '' },
})

const emit = defineEmits(['toc-click'])

const nav = DOCS_NAV
const sidebarOpen = ref(false)

// Close the mobile drawer whenever the page changes.
watch(() => props.current, () => { sidebarOpen.value = false })

function onTocClick(id) {
  emit('toc-click', id)
}
</script>

<style scoped>
.docs-shell {
  padding-top: 59px; /* fixed gradient-bar (3px) + navbar (56px) */
  min-height: 100vh;
  background: var(--bg);
}

.docs-grid {
  max-width: 1440px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 200px;
  gap: 40px;
  padding: 0 24px;
  align-items: start;
}

/* ── Sidebar ── */
.docs-sidebar {
  position: sticky;
  top: 59px;
  align-self: start;
  height: calc(100vh - 59px);
  overflow-y: auto;
  padding: 32px 0 40px;
}
.docs-nav-home {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  margin-bottom: 20px;
  letter-spacing: -0.01em;
}
.docs-nav-group {
  margin-bottom: 22px;
}
.docs-nav-grouptitle {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.docs-nav-link {
  display: block;
  font-size: 14px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 5px 12px;
  border-left: 2px solid transparent;
  margin-left: -2px;
  transition: color 0.15s, border-color 0.15s;
  line-height: 1.4;
}
.docs-nav-link:hover {
  color: var(--text-primary);
}
.docs-nav-link.active {
  color: var(--indigo);
  font-weight: 600;
  border-left-color: var(--indigo);
}

/* ── Content column ── */
.docs-content {
  min-width: 0;
  padding: 40px 0 80px;
}

/* ── Right TOC ── */
.docs-toc {
  position: sticky;
  top: 59px;
  align-self: start;
  padding: 44px 0 40px;
  max-height: calc(100vh - 59px);
  overflow-y: auto;
}
.docs-toc-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.docs-toc-link {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 0;
  line-height: 1.4;
  border-left: 2px solid var(--border);
  padding-left: 12px;
  margin-left: -2px;
  transition: color 0.15s, border-color 0.15s;
}
.docs-toc-link.lvl-3 {
  padding-left: 24px;
  font-size: 12.5px;
}
.docs-toc-link:hover {
  color: var(--text-primary);
}
.docs-toc-link.active {
  color: var(--indigo);
  border-left-color: var(--indigo);
}

/* ── Mobile bar / drawer ── */
.docs-mobilebar {
  display: none;
}
.docs-scrim {
  display: none;
}

@media (max-width: 1024px) {
  .docs-grid {
    grid-template-columns: 220px minmax(0, 1fr);
  }
  .docs-toc {
    display: none;
  }
}

@media (max-width: 768px) {
  .docs-mobilebar {
    display: block;
    position: sticky;
    top: 59px;
    z-index: 40;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 10px 24px;
  }
  .docs-menu-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .docs-menu-icon {
    font-size: 16px;
  }
  .docs-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .docs-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    max-width: 84vw;
    height: 100%;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 24px 20px 40px;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    z-index: 60;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  }
  .docs-sidebar.open {
    transform: translateX(0);
  }
  .docs-scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 50;
  }
  .docs-content {
    padding: 24px 0 60px;
  }
}
</style>
