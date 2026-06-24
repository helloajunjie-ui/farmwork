<script setup lang="ts">
import { useUserStore } from '../stores/user'
import { formatGold } from '../utils/format'

const userStore = useUserStore()
</script>

<template>
  <div class="flex items-center gap-1 text-xs text-slate-400">
    <span class="font-mono tabular-nums">{{ formatGold(userStore.gold) }}</span>
  </div>
</template>
