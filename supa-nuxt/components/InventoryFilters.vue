<template>
    <div class="filter-options">
        <button
            v-for="filter in filters"
            :key="filter.value"
            :class="['filter-btn', { active: modelValue === filter.value }]"
            :data-filter="filter.value"
            @click="$emit('update:modelValue', filter.value)"
        >
            {{ filter.label }}
        </button>
    </div>
   </template>
   
   <script setup>
    defineProps({
        modelValue: String // bound using v-model
    })
    defineEmits(['update:modelValue'])
   
    const filters = [
        { value: 'all', label: 'All Items' },
        { value: 'low', label: 'Low Stock' },
        { value: 'medium', label: 'Medium Stock' },
        { value: 'high', label: 'High Stock' },
    ]
   </script>
   
   <style scoped>
       /* Uses styles from main.css */
   </style>