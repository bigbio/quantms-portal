<template>
  <button
    type="button"
    class="report-issue"
    @click="report"
    title="Found a problem? Report it on GitHub"
    aria-label="Report an issue"
  >
    <svg class="report-issue-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <!-- little bug icon -->
      <path d="M8 2l1.5 1.5M16 2l-1.5 1.5" />
      <rect x="8" y="6" width="8" height="12" rx="4" />
      <path d="M12 6v12M3 9h3M3 13h3M3 17h4M18 9h3M18 13h3M17 17h4" />
    </svg>
    <span class="report-issue-label">Report an issue</span>
  </button>
</template>

<script setup>
// Opens a NEW GitHub issue prefilled with the exact page the user was on (and their browser),
// so reports carry the context we need to reproduce. Read window.location at click time so it
// reflects the current route in this SPA.
const ISSUES_NEW = 'https://github.com/bigbio/quantms-portal/issues/new'

function report() {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const body = [
    '<!-- Describe the issue you found. Screenshots and the exact query help a lot. -->',
    '',
    '',
    '---',
    `**Page:** ${url}`,
    `**Browser:** ${ua}`,
  ].join('\n')
  const params = new URLSearchParams({
    title: '[Portal] ',
    body,
    labels: 'portal,user-report',
  })
  window.open(`${ISSUES_NEW}?${params.toString()}`, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.report-issue {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 900;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-secondary);
  font: 500 13px/1 var(--font);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(8, 43, 79, 0.14);
}
.report-issue:hover {
  color: var(--brand-deep);
  border-color: var(--brand);
}
.report-issue:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}
.report-issue-icon { flex: none; }

/* On narrow screens collapse to an icon-only button so it never covers content. */
@media (max-width: 640px) {
  .report-issue { padding: 12px; }
  .report-issue-label { display: none; }
}
</style>
