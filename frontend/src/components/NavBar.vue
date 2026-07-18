<template>
  <nav class="nav">
    <div class="nav-inner">
      <router-link to="/" class="nav-logo">
        <svg class="logo-svg" width="34" height="34" viewBox="0 0 70 70" fill="none">
          <polygon points="35,56 10,46 35,36 60,46" fill="#409eff" opacity="0.3"/>
          <polygon points="35,48 14,40 35,32 56,40" fill="#6366f1" opacity="0.5"/>
          <polygon points="35,40 18,34 35,28 52,34" fill="#7c3aed" opacity="0.65"/>
          <rect x="24" y="20" width="2.5" height="6" rx="0.8" fill="#7c3aed" opacity="0.4"/>
          <rect x="28" y="14" width="2.5" height="12" rx="0.8" fill="#8b5cf6" opacity="0.55"/>
          <rect x="32" y="8" width="2.5" height="18" rx="0.8" fill="#7c3aed" opacity="0.8"/>
          <rect x="36" y="12" width="2.5" height="14" rx="0.8" fill="#8b5cf6" opacity="0.6"/>
          <rect x="40" y="18" width="2.5" height="8" rx="0.8" fill="#7c3aed" opacity="0.45"/>
        </svg>
        <span>quant<span class="logo-accent">ms</span> <span class="nav-portal-badge">Portal</span></span>
      </router-link>
      <button
        type="button"
        class="nav-hamburger"
        aria-label="Toggle navigation menu"
        :aria-expanded="mobileOpen"
        aria-controls="nav-links"
        @click="mobileOpen = !mobileOpen"
      >
        <span class="nav-hamburger-icon" aria-hidden="true">{{ mobileOpen ? '✕' : '☰' }}</span>
      </button>
      <div id="nav-links" class="nav-links" :class="{ open: mobileOpen }">
        <router-link to="/apps/peptide-search">Peptide Search</router-link>
        <router-link to="/statistics">Statistics</router-link>

        <!-- Data dropdown -->
        <div
          class="nav-dropdown"
          @mouseenter="open('data')"
          @mouseleave="close('data')"
          @focusout="onFocusOut('data', $event)"
        >
          <button
            type="button"
            class="nav-dropdown-trigger"
            :class="{ 'is-active': isDataActive }"
            aria-haspopup="true"
            :aria-expanded="openMenu === 'data'"
            @click="toggle('data')"
            @keydown.escape="closeAll"
          >
            Data <span class="nav-caret" aria-hidden="true">&#9662;</span>
          </button>
          <div v-show="openMenu === 'data'" class="nav-dropdown-menu" role="menu">
            <router-link to="/apps/dataset-search" role="menuitem">Datasets</router-link>
            <router-link to="/collections" role="menuitem">Collections</router-link>
            <router-link to="/models" role="menuitem">Models</router-link>
            <router-link to="/baseline" role="menuitem">Baseline</router-link>
          </div>
        </div>

        <a href="https://api.quantms.org/docs" class="nav-link-ext" target="_blank" rel="noopener">API &amp; MCP &#8599;</a>

        <!-- About dropdown -->
        <div
          class="nav-dropdown"
          @mouseenter="open('about')"
          @mouseleave="close('about')"
          @focusout="onFocusOut('about', $event)"
        >
          <button
            type="button"
            class="nav-dropdown-trigger"
            :class="{ 'is-active': isAboutActive }"
            aria-haspopup="true"
            :aria-expanded="openMenu === 'about'"
            @click="toggle('about')"
            @keydown.escape="closeAll"
          >
            About <span class="nav-caret" aria-hidden="true">&#9662;</span>
          </button>
          <div v-show="openMenu === 'about'" class="nav-dropdown-menu" role="menu">
            <router-link to="/docs" role="menuitem">Docs</router-link>
            <router-link to="/contact" role="menuitem">Contact</router-link>
            <a href="https://quantms.org" class="nav-link-ext" role="menuitem" target="_blank" rel="noopener">quantms.org &#8599;</a>
          </div>
        </div>
      </div>
    </div>
    <div v-if="mobileOpen" class="nav-scrim" @click="mobileOpen = false"></div>
  </nav>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const openMenu = ref(null)
// Mobile navigation drawer (revealed by the hamburger toggle ≤768px).
const mobileOpen = ref(false)

// Paths grouped under each dropdown, used for active-state highlighting.
const dataPaths = ['/apps/dataset-search', '/collections', '/models', '/baseline']
const aboutPaths = ['/docs', '/contact']

const isDataActive = computed(() => dataPaths.some((p) => route.path.startsWith(p)))
const isAboutActive = computed(() => aboutPaths.some((p) => route.path.startsWith(p)))

function open(menu) {
  openMenu.value = menu
}
function close(menu) {
  if (openMenu.value === menu) openMenu.value = null
}
function toggle(menu) {
  openMenu.value = openMenu.value === menu ? null : menu
}
function closeAll() {
  openMenu.value = null
}

// Close a dropdown when keyboard focus leaves it entirely (Tab-out).
function onFocusOut(menu, event) {
  if (!event.currentTarget.contains(event.relatedTarget)) close(menu)
}

// Close on outside click.
function onDocumentClick(event) {
  if (!event.target.closest('.nav-dropdown')) closeAll()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

// Close on route change (e.g. navigating via a dropdown link or mobile drawer).
watch(() => route.fullPath, () => {
  closeAll()
  mobileOpen.value = false
})
</script>

<style scoped>
/* Hamburger toggle: hidden on desktop, shown ≤768px. */
.nav-hamburger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
}
.nav-hamburger-icon {
  font-size: 22px;
  line-height: 1;
}
.nav-scrim {
  display: none;
}
.nav-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.nav-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color 0.15s;
}
.nav-dropdown-trigger:hover,
.nav-dropdown-trigger:focus-visible {
  color: var(--text-primary);
}
.nav-dropdown-trigger.is-active {
  color: var(--indigo);
}
.nav-caret {
  font-size: 10px;
  line-height: 1;
  transition: transform 0.15s;
}
.nav-dropdown-trigger[aria-expanded='true'] .nav-caret {
  transform: rotate(180deg);
}
.nav-dropdown-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  min-width: 168px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  z-index: 1100;
}
/* Invisible bridge so hover survives the gap between trigger and menu. */
.nav-dropdown-menu::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 0;
  right: 0;
  height: 10px;
}
.nav-dropdown-menu a {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    color 0.15s,
    background 0.15s;
}
.nav-dropdown-menu a:hover,
.nav-dropdown-menu a:focus-visible {
  color: var(--text-primary);
  background: var(--bg-alt);
}
.nav-dropdown-menu a.router-link-active {
  color: var(--indigo);
  background: rgba(99, 102, 241, 0.08);
}
.nav-dropdown-menu .nav-link-ext {
  opacity: 0.85;
  font-size: 13px;
}
.nav-dropdown-menu .nav-link-ext:hover {
  opacity: 1;
}

/* ── Mobile drawer (≤768px) ────────────────────────────────────────────────
   The global stylesheet hides .nav-links at this width; the hamburger reveals
   them as a stacked sheet below the bar. Dropdowns flatten to inline lists so
   every item (Peptide Search, Statistics, Data, About, Docs, Contact) is
   reachable without hover. */
@media (max-width: 768px) {
  .nav-hamburger {
    display: inline-flex;
  }
  .nav-links.open {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    position: fixed;
    top: 59px;
    left: 0;
    right: 0;
    padding: 14px 24px 22px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
    max-height: calc(100vh - 59px);
    overflow-y: auto;
    z-index: 1200;
  }
  .nav-links.open > a,
  .nav-links.open .nav-dropdown {
    padding: 8px 0;
    width: 100%;
  }
  .nav-links.open .nav-dropdown {
    position: static;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .nav-links.open .nav-dropdown-menu {
    position: static;
    display: flex;
    min-width: 0;
    margin-top: 4px;
    padding: 4px 0 4px 12px;
    border: none;
    border-left: 2px solid var(--border);
    border-radius: 0;
    box-shadow: none;
  }
  .nav-links.open .nav-dropdown-menu::before {
    display: none;
  }
  .nav-scrim {
    display: block;
    position: fixed;
    inset: 59px 0 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 1150;
  }
}
</style>
