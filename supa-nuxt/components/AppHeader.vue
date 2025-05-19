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
          <iframe :src="iframeSrc" width="250" height="32" frameborder="0" scrolling="no" style="color-scheme: normal"></iframe>
        </div>
        <button @click="toggleColorMode" class="color-mode-toggle-btn" aria-label="Toggle color mode">
          <i v-if="colorModeValue === 'light'" class="fas fa-sun"></i>
          <i v-else class="fas fa-moon"></i>
        </button>
      </div>
    </header>
  </template>
  
  <script setup>
import { computed } from 'vue';
import { useColorModeExtended } from '~/composables/useColorMode';

const { colorModeValue, toggleColorMode } = useColorModeExtended();

  defineProps({
    searchTerm: String,
    isConnected: Boolean
  })
  defineEmits(['update:searchTerm'])
  
  const reloadPage = () => {
      window.location.reload();
  }

const iframeSrc = computed(() => {
  const theme = colorModeValue.value === 'dark' ? 'dark' : 'light';
  return `https://status.harshalmore.dev/badge?theme=${theme}`;
});
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

/* Styles for the color mode toggle button */
.color-mode-toggle-btn {
  background: none;
  border: none;
  color: var(--text); /* Use CSS variable for color */
  cursor: pointer;
  font-size: 1.2rem; /* Adjust size as needed */
  padding: 5px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px; /* Match height of status indicator/badge for alignment */
  height: 32px; /* Match height of status indicator/badge for alignment */
}

.color-mode-toggle-btn:hover {
  background-color: rgba(0,0,0,0.05); /* Subtle hover effect for light mode */
}

html.dark .color-mode-toggle-btn { /* Style for dark mode */
  color: var(--text); /* Ensure it uses the dark mode text color */
}

html.dark .color-mode-toggle-btn:hover {
  background-color: rgba(255,255,255,0.1); /* Subtle hover effect for dark mode */
}
  </style>