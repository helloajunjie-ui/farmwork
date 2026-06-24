<script setup lang="ts">
import { computed } from 'vue'
import { useFarmStore } from '../stores/farm'

const farmStore = useFarmStore()

const stats = computed(() => {
  const total = farmStore.plots.length
  const locked = farmStore.plots.filter((p) => p.status === 'locked').length
  const idle = farmStore.plots.filter((p) => p.status === 'idle').length
  const growing = farmStore.plots.filter((p) => p.status === 'growing').length
  const ready = farmStore.plots.filter((p) => p.status === 'ready').length
  return { total, locked, idle, growing, ready }
})
</script>

<template>
  <div class="flex items-center gap-3 text-xs">
    <span class="text-slate-500">{{ stats.total }} 块地</span>
    <span class="text-slate-400">·</span>
    <span v-if="stats.locked > 0" class="text-slate-600">{{ stats.locked }} 锁定</span>
    <span v-if="stats.locked > 0" class="text-slate-400">·</span>
    <span class="text-yellow-400">{{ stats.growing }} 生长中</span>
    <span v-if="stats.ready > 0" class="text-green-400 font-semibold">{{ stats.ready }} 可收割</span>
  </div>
</template>
