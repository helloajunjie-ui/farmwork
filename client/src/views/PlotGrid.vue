<script setup lang="ts">
import { useFarmStore } from '../stores/farm'
import PlotCard from './PlotCard.vue'

const farmStore = useFarmStore()
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <PlotCard
      v-for="plot in farmStore.plots"
      :key="plot.plot_id"
      :plot="plot"
    />
  </div>
</template>
