<script setup lang="ts">
import { useAuth } from '../auth'

const isLoggedIn = (): boolean => useAuth()?.isLoggedIn || false
</script>

<template>
    <div v-if="isLoggedIn()">
        <slot />
    </div>
</template>
