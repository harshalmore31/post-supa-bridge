<template>
    <div class="loader-container">
      <div class="loading-spinner"></div>
      <div class="loader-text">{{ text }}</div>
    </div>
  </template>
 
  <script setup>
  defineProps({
    text: {
      type: String,
      default: 'Loading...'
    }
  })
  </script>
 
  <style scoped>
  /* Minimal styles, assuming main.css has the rest */
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }
  /* Ensure loading-spinner animation is in main.css */
  </style>