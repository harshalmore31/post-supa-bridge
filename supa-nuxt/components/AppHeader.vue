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
      <div class="header-right">
        <div class="status-indicator">
          <div :class="['dot', { 'offline': !isConnected }]"></div>
          <span id="status-text">{{ isConnected ? 'Connected' : 'Disconnected' }}</span>
        </div>
        <div class="status-badge">
          <iframe src="https://status.harshalmore.dev/badge?theme=light" width="250" height="32" frameborder="0" scrolling="no" style="color-scheme: normal"></iframe>
        </div>
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
  /* Additional styles for header layout */
  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    height: 32px; /* Match the height of iframe */
  }

  .status-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 49px; /* Match the height of iframe */
  }

  /* Adjust position of dot to align with iframe content */
  .status-indicator .dot {
    margin-top: 1px;
  }

  @media (max-width: 768px) {
    .header-right {
      width: 100%;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .status-indicator {
      justify-content: center;
      margin-bottom: 5px;
    }
  }
  </style>