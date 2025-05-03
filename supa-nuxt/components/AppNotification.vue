<template>
    <transition name="notification-slide">
      <div v-if="notification.show" :class="['notification', `notification-${notification.type}`]">
        <div class="notification-icon">
          <i :class="['fas', iconClass]"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ notification.title }}</div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
        <div class="notification-close" @click="closeNotification">
          <i class="fas fa-times"></i>
        </div>
      </div>
    </transition>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import { useNotifications } from '~/composables/useNotifications';
  
  const { notification, closeNotification } = useNotifications();
  
  const iconClass = computed(() => {
    switch (notification.value.type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-exclamation-circle';
      case 'warning': return 'fa-exclamation-triangle';
      default: return 'fa-info-circle';
    }
  });
  </script>
  
  <style scoped>
  /* Styles from main.css plus transition */
  .notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    /* Add other styles from main.css here or ensure they are global */
    border-left-width: 4px;
    border-left-style: solid;
    z-index: 1000;
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  }
  
   /* Specific styles per type */
  .notification-info { border-left-color: var(--primary); }
  .notification-success { border-left-color: var(--success); }
  .notification-error { border-left-color: var(--danger); }
  .notification-warning { border-left-color: var(--warning); }
  
  /* Icon colors (optional, can inherit from border) */
  .notification-info .notification-icon { color: var(--primary); }
  .notification-success .notification-icon { color: var(--success); }
  .notification-error .notification-icon { color: var(--danger); }
  .notification-warning .notification-icon { color: var(--warning); }
  
  /* Transitions */
  .notification-slide-enter-from,
  .notification-slide-leave-to {
    transform: translateX(calc(100% + 20px));
    opacity: 0;
  }
  .notification-slide-enter-to,
  .notification-slide-leave-from {
    transform: translateX(0);
    opacity: 1;
  }
  </style>