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
      <div class="nav-links">
        <router-link to="/collections">Collections</router-link>
        <router-link to="/apps/dataset-search">Dataset Search</router-link>
        <router-link to="/search">Search</router-link>
        <router-link to="/statistics">Statistics</router-link>
        <router-link to="/baseline">Baseline</router-link>
        <router-link to="/models">Models</router-link>
        <router-link to="/contact">Contact</router-link>
        <router-link to="/api">API &amp; MCP</router-link>
        <a href="https://quantms.org" class="nav-link-ext" target="_blank" rel="noopener">quantms.org &#8599;</a>
      </div>
    </div>
  </nav>
</template>
