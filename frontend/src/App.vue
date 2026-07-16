<template>
  <div class="gradient-bar"></div>
  <NavBar />
  <router-view />
  <AppFooter />
  <ReportIssue />
</template>

<script setup>
import NavBar from './components/NavBar.vue'
import AppFooter from './components/Footer.vue'
import ReportIssue from './components/ReportIssue.vue'
</script>
