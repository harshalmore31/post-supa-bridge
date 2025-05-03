<template>
    <div class="stat-card">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">{{ value }}</div>
        <div :class="['stat-footer', footerClass]">
            <i :class="['fas', icon]"></i>
            <span>{{ footerText }}</span>
        </div>
    </div>
   </template>
   
   <script setup>
    defineProps({
        title: String,
        value: [String, Number],
        icon: String, // e.g., 'fa-box', 'fa-rupee-sign'
        footerText: String,
        footerClass: String // e.g., 'positive', 'negative', or empty
    })
   </script>
   
   <style scoped>
       /* Uses styles from main.css */
   </style>