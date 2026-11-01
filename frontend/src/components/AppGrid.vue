<template>
  <ul class="app-grid">
    <li
      v-for="app in apps"
      :key="app.id"
      class="app-card"
      :class="{ 'app-card-obsolete': app.obsolete, 'app-card-registry': app.registry, 'data-in': app.registry }"
    >
      <img v-if="app.image" :src="app.image" alt="" width="900" height="406" loading="lazy" />
      <div class="app-body">
        <div class="app-card-head">
          <h3 v-if="app.obsolete || app.registry">{{ app.title }}</h3>
          <!-- The title link is stretched over the whole card, so the separate
               "API docs" link is not nested inside another link. -->
          <h3 v-else><router-link :to="app.to" class="app-card-link">{{ app.title }}</router-link></h3>
          <span v-if="app.obsolete" class="app-badge-obsolete">Obsolete</span>
        </div>
        <p class="app-desc">{{ app.description }}</p>
        <p v-if="app.obsolete" class="app-obsolete-note">{{ app.obsoleteNote }}</p>
        <p v-else-if="app.registry" class="app-obsolete-note">Listed in the gateway app registry; it has no portal page yet.</p>
        <a v-if="!app.obsolete && app.docs" :href="app.docs" class="app-doclink" target="_blank" rel="noopener">API docs ↗</a>
      </div>
    </li>
  </ul>
</template>

<script setup>
defineProps({
  apps: { type: Array, required: true },
})
</script>

<style scoped>
.app-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  list-style: none;
}
.app-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface);
}
.app-card:not(.app-card-obsolete, .app-card-registry):hover {
  border-color: var(--brand);
}
.app-card:has(.app-card-link:focus-visible) {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.app-card img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 900 / 406;
  object-fit: cover;
  object-position: top left;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-alt);
}
.app-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 12px 14px 14px;
}
.app-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}
.app-card-head h3 {
  font-size: 17px;
  font-weight: 600;
  color: var(--brand-deep);
}
.app-card-link {
  color: inherit;
  text-decoration: none;
}
.app-card-link::after {
  content: '';
  position: absolute;
  inset: 0;
}
.app-card-link:focus-visible {
  outline: none;
}
.app-card:hover .app-card-link {
  text-decoration: underline;
}
.app-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.55;
  flex: 1;
}
.app-doclink {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  margin-top: 10px;
  font-size: 13px;
  color: var(--brand);
}
.app-card-obsolete {
  background: var(--bg-alt);
}
.app-card-obsolete h3 {
  color: var(--text-secondary);
}
.app-badge-obsolete {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  padding: 1px 7px;
  border-radius: 3px;
  color: #7d4e00;
  background: #fff1c2;
}
.app-obsolete-note {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
}
@media (max-width: 1024px) {
  .app-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .app-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
