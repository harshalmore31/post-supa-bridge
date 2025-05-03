<template>
    <div id="inventory-content">
      <LoadingSpinner v-if="isLoading" text="Loading inventory data..." />
  
      <ConnectionError
          v-else-if="connectionError"
          :message="connectionError"
          @retry="$emit('retryConnection')"
      />
  
      <EmptyState v-else-if="!items || items.length === 0" />
  
      <div v-else class="inventory-grid" id="inventory-grid">
        <ProductCard v-for="item in items" :key="item.item_id" :item="item" />
      </div>
    </div>
  </template>
  
  <script setup>
  import ProductCard from './ProductCard.vue';
  import LoadingSpinner from './LoadingSpinner.vue';
  import ConnectionError from './ConnectionError.vue';
  import EmptyState from './EmptyState.vue';
  
  defineProps({
    items: Array,
    isLoading: Boolean,
    connectionError: String // Pass error message
  })
  defineEmits(['retryConnection'])
  </script>
  
  <style scoped>
     /* Uses styles from main.css */
  </style>