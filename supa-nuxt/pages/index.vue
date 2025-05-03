<template>
    <div class="container">
      <AppHeader
        :isConnected="isConnected"
        :searchTerm="searchTerm"
        @update:searchTerm="updateSearchTerm"
      />
  
      <StatsContainer :stats="stats" :lastUpdated="lastUpdated" />
  
      <div class="inventory-container">
        <div class="inventory-header">
          <h2 class="inventory-title">Product Inventory</h2>
          <InventoryFilters v-model="currentFilter" />
        </div>
  
        <InventoryGrid
          :items="filteredItems"
          :isLoading="isLoading"
          :connectionError="connectionError"
          @retryConnection="retryConnection"
        />
      </div>
    </div>
  </template>
  
  <script setup>
  import { useInventory } from '~/composables/useInventory';
  import AppHeader from '~/components/AppHeader.vue';
  import StatsContainer from '~/components/StatsContainer.vue';
  import InventoryFilters from '~/components/InventoryFilters.vue';
  import InventoryGrid from '~/components/InventoryGrid.vue';
  
  // Use the composable to get all state and methods
  const {
    filteredItems,
    isLoading,
    connectionError,
    isConnected,
    lastUpdated,
    searchTerm,
    currentFilter,
    stats,
    retryConnection
  } = useInventory();
  
  // Method to update search term (could be directly bound with v-model too)
  const updateSearchTerm = (value) => {
    searchTerm.value = value;
  };
  
  // Set page title (optional)
  useHead({
      title: 'Inventory Management System'
  })
  
  </script>
  
  <style>
    /* Page specific styles if any, otherwise rely on main.css */
  </style>