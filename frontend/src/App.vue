<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="gradient-bar"></div>
  <NavBar />
  <main id="main-content">
    <router-view />
  </main>
  <AppFooter />
  <ReportIssue />
</template>

<script setup>
import NavBar from './components/NavBar.vue'
import AppFooter from './components/Footer.vue'
import ReportIssue from './components/ReportIssue.vue'
</script>
