<template>
  <div class="gradient-bar"></div>
  <NavBar />
  <router-view />
  <AppFooter />
</template>

<script setup>
import NavBar from './components/NavBar.vue'
import AppFooter from './components/Footer.vue'
</script>
