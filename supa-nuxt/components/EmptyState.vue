<template>
    <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
    </div>
   </template>
   
   <script setup>
    defineProps({
        title: { type: String, default: 'No items found' },
        message: { type: String, default: 'Try adjusting your search or filter criteria.'}
    })
   </script>
   
   <style scoped>
    /* Uses styles from main.css */
    .empty-state {
      grid-column: 1 / -1; /* Span across all grid columns */
      text-align: center;
      padding: 60px 20px;
      color: var(--text-light);
    }
   </style>