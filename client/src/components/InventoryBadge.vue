<script setup lang="ts">
import { useUserStore } from '../stores/user'
import { formatAmountCompact } from '../utils/format'

const userStore = useUserStore()
</script>

<template>
  <div class="flex items-center gap-4 text-xs">
    <div class="flex items-center gap-1 text-slate-400">
      <span>🌽</span>
      <span class="font-mono tabular-nums text-slate-200">{{ formatAmountCompact(userStore.items.corn ?? 0) }}</span>
    </div>
    <div class="flex items-center gap-1 text-slate-400">
      <span>🌱</span>
      <span class="font-mono tabular-nums text-slate-200">{{ (userStore.items.seed ?? 0).toLocaleString() }}</span>
    </div>
  </div>
</template>
