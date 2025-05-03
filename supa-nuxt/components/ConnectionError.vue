<template>
    <div class="connection-error">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <button v-if="showRetry" @click="$emit('retry')" class="retry-btn">Retry Connection</button>
    </div>
  </template>
  
  <script setup>
  defineProps({
    title: { type: String, default: 'Connection Error' },
    message: { type: String, required: true },
    showRetry: { type: Boolean, default: true }
  })
  defineEmits(['retry'])
  </script>
  
  <style scoped>
   /* Styles for connection error - can be in main.css or here */
  .connection-error {
      text-align: center;
      padding: 40px 20px;
      border: 1px solid var(--danger);
      background-color: rgba(230, 57, 70, 0.05);
      color: var(--danger);
      border-radius: 8px;
      margin: 20px auto;
      max-width: 600px;
  }
  .connection-error i {
      font-size: 36px;
      margin-bottom: 15px;
      display: block;
  }
  .connection-error h3 {
      margin-bottom: 10px;
      color: var(--danger); /* Ensure heading also uses danger color */
  }
  .connection-error p {
      margin-bottom: 20px;
      color: var(--text-light);
  }
  .retry-btn {
      padding: 10px 20px;
      background-color: var(--primary);
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s;
  }
  .retry-btn:hover {
      background-color: var(--secondary);
  }
  </style>