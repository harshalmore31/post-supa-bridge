<template>
    <div>
      <slot />
      <AppNotification /> <!-- Add notification component globally -->
      <PerformanceLogsButton />
    </div>
  </template>
  
  <script setup>
  import AppNotification from '~/components/AppNotification.vue';
  </script>
  
  <style>
  /* You could add global layout styles here if needed */
  </style>