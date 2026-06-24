<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchReadonlyFarm } from '../api'
import type { ReadonlyFarmData } from '../types'
import { formatSeconds } from '../utils/format'

const props = defineProps<{
  show: boolean
  username: string | null
}>()

const emit = defineEmits<{
  close: []
  sendMail: [username: string]
}>()

const farm = ref<ReadonlyFarmData | null>(null)
const loading = ref(false)
const error = ref('')

watch(
  () => props.show,
  async (val) => {
    if (val && props.username) {
      loading.value = true
      error.value = ''
      farm.value = null
      try {
        farm.value = await fetchReadonlyFarm(props.username)
      } catch (e: any) {
        error.value = e?.message || '获取农场数据失败'
      } finally {
        loading.value = false
      }
    }
  }
)

function getStatusLabel(status: string): string {
  switch (status) {
    case 'locked': return '🔒 未解锁'
    case 'idle': return '🟤 闲置'
    case 'growing': return '🌱 生长中'
    case 'ready': return '🌟 已成熟'
    default: return status
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[110] flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <!-- 冷色调滤镜背景 -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <!-- 内容卡片 -->
      <div
        v-if="!loading && farm"
        class="relative w-full max-w-md rounded-2xl border border-slate-600/50 bg-slate-800/95 backdrop-blur-xl overflow-hidden transition-all duration-500 animate-fade-in"
        style="filter: hue-rotate(200deg) saturate(0.6) brightness(0.9);"
      >
        <!-- 顶部：目标玩家信息 -->
        <div class="p-5 border-b border-slate-700/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-300">
              {{ farm.nickname.charAt(0) }}
            </div>
            <div>
              <h3 class="text-base font-semibold text-slate-200">{{ farm.nickname }} 的农场</h3>
              <span class="text-xs text-slate-500">{{ farm.housing.emoji }} {{ farm.housing.name }}</span>
            </div>
          </div>
        </div>

        <!-- 地块网格（只读） -->
        <div class="p-5">
          <h4 class="text-xs font-medium text-slate-500 mb-3">🏞️ 地块状态</h4>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="plot in farm.plots"
              :key="plot.plot_id"
              class="rounded-xl border border-slate-700/50 bg-slate-700/10 p-3 text-center"
            >
              <div class="text-xl mb-1">
                {{ plot.crop_emoji || '🟫' }}
              </div>
              <div class="text-[10px] text-slate-400 truncate">
                {{ plot.crop_name || getStatusLabel(plot.status) }}
              </div>
              <div v-if="plot.status === 'growing'" class="text-[10px] font-mono text-cyan-400/60 mt-0.5">
                {{ formatSeconds(plot.remaining_seconds) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 投递密函按钮 -->
        <button
          class="w-full py-3.5 text-sm font-medium bg-amber-500/10 text-amber-300 border-t border-amber-500/20 hover:bg-amber-500/20 transition-all duration-200"
          @click="emit('sendMail', farm.nickname)"
        >
          📜 投递密函
        </button>

        <!-- 关闭 -->
        <button
          class="w-full py-2.5 text-xs text-slate-500 hover:text-slate-400 transition-colors bg-black/10"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>

      <!-- 加载骨架 -->
      <div
        v-else-if="loading"
        class="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-800/90 backdrop-blur-xl p-8 animate-pulse"
      >
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-full bg-slate-700" />
          <div class="h-4 w-32 bg-slate-700 rounded" />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="i in 6" :key="i" class="h-20 rounded-xl bg-slate-700" />
        </div>
      </div>

      <!-- 错误 -->
      <div
        v-else-if="error"
        class="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-800/90 backdrop-blur-xl p-8 text-center"
      >
        <div class="text-4xl mb-3">🔍</div>
        <p class="text-red-400 text-sm">{{ error }}</p>
        <button class="mt-4 text-sm text-slate-500 hover:text-slate-400" @click="emit('close')">关闭</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
