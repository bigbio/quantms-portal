<template>
  <span v-if="value != null" class="data-in">{{ value }}</span>
  <span v-else class="skel" :style="{ width }" aria-hidden="true" />
</template>

<script setup>
// A value fetched at runtime: a placeholder of about the final width holds its
// place while it loads, so the surrounding layout does not jump when it arrives.
defineProps({
  value: { type: [String, Number], default: null },
  width: { type: String, default: '3ch' },
})
</script>
