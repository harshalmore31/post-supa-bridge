<template>
    <div :id="`product-${item.item_id}`" class="product-card fade-in">
      <div class="product-header">
        <div class="product-header-content">
          <div class="product-title">{{ item.name || 'Unnamed Product' }}</div>
          <div class="product-sku">{{ item.sku || 'No SKU' }}</div>
        </div>
        <div :class="['status-indicator', `status-${stockLevel}`]">
          <div :class="['stock-indicator', `stock-${stockLevel}`]"></div>
          {{ stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1) }} Stock
        </div>
      </div>
      <div class="product-body">
        <div>
          <div class="product-info">
            <div class="info-label">Selling Price</div>
            <div class="info-value price-highlight">{{ formattedRate }}</div>
          </div>
          <div class="product-info">
            <div class="info-label">Purchase Price</div>
            <div class="info-value">{{ formattedPurchaseRate }}</div>
          </div>
          <div class="product-info">
            <div class="info-label">Profit Margin</div>
            <div class="info-value">
              {{ profitMargin }}%
              <span :class="['profit-indicator', `profit-${profitLevel}`]">
                  {{ profitLevel.toUpperCase() }}
              </span>
            </div>
          </div>
          <div class="product-info">
            <div class="info-label">Stock On Hand</div>
            <div class="info-value">{{ stockOnHand }} units</div>
          </div>
        </div>
        <div class="stock-section">
          <div class="stock-bar">
            <div
              class="stock-fill"
              :style="{ width: stockPercent + '%', backgroundColor: stockLevelColor }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import { useFormatting } from '~/composables/useFormatting';
  
  const props = defineProps({
    item: {
      type: Object,
      required: true
    }
  });
  
  const { formatIndianCurrency, calculateProfitMargin, getStockLevel } = useFormatting();
  
  const stockOnHand = computed(() => parseInt(props.item['stock on hand'], 10) || 0);
  const sellingRate = computed(() => props.item.rate || 0); // Already a number from processing
  const purchaseRate = computed(() => props.item['purchase rate'] || 0); // Already a number
  
  const stockLevel = computed(() => getStockLevel(stockOnHand.value));
  const stockPercent = computed(() => Math.min(stockOnHand.value / 100 * 100, 100)); // Assuming 100 is max visual scale
  
  const profitMargin = computed(() => calculateProfitMargin(sellingRate.value, purchaseRate.value));
  const profitLevel = computed(() => {
    const margin = parseFloat(profitMargin.value);
    if (margin > 30) return 'high';
    if (margin > 15) return 'medium';
    return 'low';
  });
  
  const formattedRate = computed(() => formatIndianCurrency(sellingRate.value));
  const formattedPurchaseRate = computed(() => formatIndianCurrency(purchaseRate.value));
  
  const stockLevelColor = computed(() => {
      switch(stockLevel.value) {
          case 'low': return 'var(--danger)';
          case 'medium': return 'var(--warning)';
          case 'high': return 'var(--success)';
          default: return 'var(--text-light)';
      }
  });
  </script>
  
  <style scoped>
      /* Uses styles from main.css */
  </style>