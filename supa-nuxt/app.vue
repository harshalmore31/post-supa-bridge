<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
      <Analytics />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { Analytics } from '@vercel/analytics/nuxt';

// Application-wide setup code can go here
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f9f9f9;
  color: #1a1a1a;
}

#__nuxt {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
