<template>
    <div class="stats-container">
      <StatCard
        title="Total Products"
        :value="stats.totalProducts"
        icon="fa-box"
        footerText="Items in inventory"
      />
      <StatCard
        title="Total Stock Value"
        :value="formattedTotalValue"
        icon="fa-rupee-sign"
        footerText="Current value"
      />
      <StatCard
        title="Low Stock Items"
        :value="stats.lowStockCount"
        icon="fa-exclamation-triangle"
        footerText="Need attention"
        footerClass="negative"
      />
      <StatCard
        title="Last Updated"
        :value="lastUpdated"
        icon="fa-sync-alt"
        footerText="Real-time sync"
      />
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import StatCard from './StatCard.vue';
  import { useFormatting } from '~/composables/useFormatting';
  
  const props = defineProps({
    stats: {
      type: Object,
      required: true,
      default: () => ({ totalProducts: 0, totalValue: 0, lowStockCount: 0 })
    },
    lastUpdated: {
      type: String,
      default: '--'
    }
  })
  
  const { formatIndianCurrency } = useFormatting();
  
  const formattedTotalValue = computed(() => formatIndianCurrency(props.stats.totalValue));
  </script>
  
  <style scoped>
    /* Uses styles from main.css */
  </style>