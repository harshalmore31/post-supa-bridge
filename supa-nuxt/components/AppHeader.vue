<template>
    <header>
      <div class="logo" @click="reloadPage" style="cursor: pointer;">
        <i class="fas fa-boxes"></i>
        <h1>Inventory Management</h1>
      </div>
      <div class="search-container">
        <i class="fas fa-search"></i>
        <input
          type="text"
          id="search-input"
          placeholder="Search items by name or SKU..."
          :value="searchTerm"
          @input="$emit('update:searchTerm', $event.target.value)"
        />
      </div>
      <div class="status-indicator">
        <div :class="['dot', { 'offline': !isConnected }]"></div>
        <span id="status-text">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
      </div>
    </header>
  </template>
  
  <script setup>
  defineProps({
    searchTerm: String,
    isConnected: Boolean
  })
  defineEmits(['update:searchTerm'])
  
  const reloadPage = () => {
      window.location.reload();
  }
  </script>
  
  <style scoped>
      /* Uses styles from main.css */
  </style>