// composables/useNotifications.js
import { ref } from 'vue';

const notification = ref({
  show: false,
  title: '',
  message: '',
  type: 'info' // e.g., info, success, error
});

let timeoutId = null;

export const useNotifications = () => {
  const showNotification = (title, message, type = 'info', duration = 5000) => {
    clearTimeout(timeoutId); // Clear previous timeout if any
    notification.value = { show: true, title, message, type };
    timeoutId = setTimeout(() => {
      closeNotification();
    }, duration);
  };

  const closeNotification = () => {
    notification.value.show = false;
  };

  return {
    notification,
    showNotification,
    closeNotification
  };
}