<template>
  <NuxtLink to="/time" class="pl-button" title="Performance Logs">
    <span>PL</span>
  </NuxtLink>
</template>

<style scoped>
.pl-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #4f46e5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  transition: all 0.2s ease;
  letter-spacing: 0.5px;
}

.pl-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
  background-color: #4338ca;
}

.pl-button:active {
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .pl-button {
    bottom: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
    font-size: 12px;
  }
}
</style>
