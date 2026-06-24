<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Plot, CropCategory } from '../types'
import { useFarmStore } from '../stores/farm'
import { useUserStore } from '../stores/user'
import { unlockPlot } from '../api'
import { ALL_CROPS, CATEGORY_ORDER, CATEGORY_LABELS, getCropsByCategory } from '../config/crops'

const props = defineProps<{ plot: Plot }>()
const farmStore = useFarmStore()
const userStore = useUserStore()

const acting = ref(false)
const showSeedVault = ref(false)

// MVP 4.3: 使用共享配置
const seedsByCategory = computed(() => getCropsByCategory())

const activeCategory = ref<CropCategory>('grain')
const selectedSeed = ref<string>('corn')

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

// 🔴 V1.0.1: 种子库存按作物区分 — 读取 seed_{cropId}
function getSeedInventory(id: string): number {
  return userStore.items[`seed_${id}`] ?? 0
}

async function handlePlant() {
  if (acting.value || !selectedSeed.value) return
  acting.value = true
  try {
    await farmStore.plant(props.plot.plot_id, selectedSeed.value)
    showSeedVault.value = false
  } catch {
    // error 已在 store 中记录
  } finally {
    acting.value = false
  }
}

async function handleHarvest() {
  if (acting.value) return
  acting.value = true
  try {
    await farmStore.harvest(props.plot.plot_id)
  } catch {
    // error 已在 store 中记录
  } finally {
    acting.value = false
  }
}

async function handleUnlock() {
  if (acting.value || !props.plot.unlock_price) return
  if (userStore.gold < props.plot.unlock_price) {
    farmStore.error = `金币不足，需要 ${props.plot.unlock_price} 金币`
    return
  }
  acting.value = true
  try {
    await unlockPlot(props.plot.plot_id)
    await farmStore.fetchPlots()
    await userStore.fetchUserInfo()
  } catch (e: any) {
    farmStore.error = e.message ?? '解锁失败'
  } finally {
    acting.value = false
  }
}
</script>

<template>
  <!-- ===== Locked 状态 ===== -->
  <div
    v-if="plot.status === 'locked'"
    class="rounded-xl border border-slate-700/20 bg-slate-900/80 p-4 flex flex-col items-center justify-center min-h-[7rem] gap-2 cursor-pointer select-none group transition-all duration-200 hover:border-slate-600/40"
    @click="handleUnlock"
  >
    <div class="text-2xl text-slate-600 group-hover:scale-110 transition-transform duration-200">🔒</div>
    <div class="text-xs text-slate-500">解锁</div>
    <div v-if="plot.unlock_price" class="text-[10px] text-slate-600 font-mono">
      🪙 {{ plot.unlock_price }}
    </div>
  </div>

  <!-- ===== Idle 状态：种子库模态框 ===== -->
  <div
    v-else-if="plot.status === 'idle'"
    class="rounded-xl border border-slate-700/20 bg-slate-900/80 p-4 flex flex-col items-center justify-center min-h-[7rem] gap-2 cursor-pointer select-none group transition-all duration-200 hover:border-slate-600/40"
    @click="showSeedVault = true"
  >
    <div class="text-2xl text-slate-500 group-hover:scale-110 transition-transform duration-200">🌱</div>
    <div class="text-xs text-slate-400">选择种子</div>
  </div>

  <!-- ===== Growing 状态 ===== -->
  <div
    v-else-if="plot.status === 'growing' && plot.crop"
    class="rounded-xl border border-slate-700/20 bg-slate-900/80 p-4 flex flex-col items-center justify-center min-h-[7rem] gap-1"
  >
    <div class="text-2xl animate-pulse-soft">{{ ALL_CROPS[plot.crop]?.emoji ?? '🌱' }}</div>
    <div class="text-xs text-slate-300 font-medium">{{ ALL_CROPS[plot.crop]?.name ?? plot.crop }}</div>
    <div class="text-[10px] text-slate-500 font-mono tabular-nums">
      ⏱ {{ Math.max(0, plot.remaining_seconds) }}s
    </div>
  </div>

  <!-- ===== Ready 状态 ===== -->
  <div
    v-else-if="plot.status === 'ready' && plot.crop"
    class="rounded-xl border border-emerald-700/30 bg-slate-900/80 p-4 flex flex-col items-center justify-center min-h-[7rem] gap-1 cursor-pointer select-none group transition-all duration-200 hover:border-emerald-600/50"
    @click="handleHarvest"
  >
    <div class="text-2xl group-hover:scale-110 transition-transform duration-200">{{ ALL_CROPS[plot.crop]?.emoji ?? '🌱' }}</div>
    <div class="text-xs text-emerald-300 font-medium">{{ ALL_CROPS[plot.crop]?.name ?? plot.crop }}</div>
    <div class="text-[10px] text-emerald-500">✅ 可收获</div>
  </div>

  <!-- ===== MVP 5.2: 种子库 Bottom Sheet (移动端) / 居中模态框 (PC) ===== -->
  <Teleport to="body">
    <div v-if="showSeedVault" class="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <!-- 背景 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showSeedVault = false" />

      <!-- PC: 居中模态框 -->
      <div class="hidden lg:flex relative bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex-col">
        <!-- 标题 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 class="text-sm font-bold text-slate-100">🌱 种子库</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="showSeedVault = false"
          >✕</button>
        </div>

        <!-- 分类 Tab -->
        <div class="flex gap-1 px-4 py-2 border-b border-slate-700/30 overflow-x-auto">
          <button
            v-for="cat in CATEGORY_ORDER"
            :key="cat"
            class="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeCategory === cat
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeCategory = cat"
          >
            {{ CATEGORY_LABELS[cat] }}
          </button>
        </div>

        <!-- 作物列表 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div
            v-for="seed in seedsByCategory[activeCategory]"
            :key="seed.id"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
            :class="[
              selectedSeed === seed.id
                ? 'bg-blue-500/15 border border-blue-500/30'
                : 'hover:bg-slate-700/30 border border-transparent',
              getSeedInventory(seed.id) <= 0 ? 'opacity-40' : '',
            ]"
            @click="selectedSeed = seed.id"
          >
            <span class="text-lg">{{ seed.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-200">{{ seed.name }}</div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>⏱ {{ formatTime(seed.totalTimeMin) }}</span>
                <span>📦 ×{{ seed.yield }}</span>
                <span>🌱 🪙{{ seed.baseSeedPrice }}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-mono tabular-nums"
                :class="getSeedInventory(seed.id) > 0 ? 'text-slate-300' : 'text-slate-600'"
              >
                ×{{ getSeedInventory(seed.id) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="px-5 py-3 border-t border-slate-700/50 flex items-center justify-between">
          <div class="text-xs text-slate-400">
            <span v-if="selectedSeed && ALL_CROPS[selectedSeed]">
              已选：{{ ALL_CROPS[selectedSeed].emoji }} {{ ALL_CROPS[selectedSeed].name }}
            </span>
          </div>
          <button
            class="text-sm font-medium px-5 py-2 rounded-lg transition-all duration-200"
            :class="acting || getSeedInventory(selectedSeed) <= 0
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 active:scale-95'"
            :disabled="acting || getSeedInventory(selectedSeed) <= 0"
            @click="handlePlant"
          >
            {{ acting ? '⏳ 播种中...' : '🌱 播种' }}
          </button>
        </div>
      </div>

      <!-- 移动端: Bottom Sheet -->
      <div class="lg:hidden relative bg-slate-800 border-t border-slate-700 rounded-t-2xl w-full shadow-2xl max-h-[75vh] flex flex-col animate-slide-up">
        <!-- 拖拽指示条 -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        <!-- 标题 -->
        <div class="flex items-center justify-between px-5 py-2">
          <h3 class="text-sm font-bold text-slate-100">🌱 种子库</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="showSeedVault = false"
          >✕</button>
        </div>

        <!-- 分类 Tab -->
        <div class="flex gap-1 px-4 py-2 overflow-x-auto border-b border-slate-700/30">
          <button
            v-for="cat in CATEGORY_ORDER"
            :key="cat"
            class="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeCategory === cat
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeCategory = cat"
          >
            {{ CATEGORY_LABELS[cat] }}
          </button>
        </div>

        <!-- 作物列表 -->
        <div class="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
          <div
            v-for="seed in seedsByCategory[activeCategory]"
            :key="seed.id"
            class="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200"
            :class="[
              selectedSeed === seed.id
                ? 'bg-blue-500/15 border border-blue-500/30'
                : 'hover:bg-slate-700/30 border border-transparent',
              getSeedInventory(seed.id) <= 0 ? 'opacity-40' : '',
            ]"
            @click="selectedSeed = seed.id"
          >
            <span class="text-lg">{{ seed.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-200">{{ seed.name }}</div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>⏱ {{ formatTime(seed.totalTimeMin) }}</span>
                <span>📦 ×{{ seed.yield }}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-mono tabular-nums"
                :class="getSeedInventory(seed.id) > 0 ? 'text-slate-300' : 'text-slate-600'"
              >
                ×{{ getSeedInventory(seed.id) }}
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏（粘性） -->
        <div class="sticky bottom-0 px-5 py-3 border-t border-slate-700/50 bg-slate-800 flex items-center justify-between safe-area-bottom">
          <div class="text-xs text-slate-400">
            <span v-if="selectedSeed && ALL_CROPS[selectedSeed]">
              {{ ALL_CROPS[selectedSeed].emoji }} {{ ALL_CROPS[selectedSeed].name }}
            </span>
          </div>
          <button
            class="text-sm font-medium px-6 py-2.5 rounded-xl transition-all duration-200"
            :class="acting || getSeedInventory(selectedSeed) <= 0
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 active:scale-95'"
            :disabled="acting || getSeedInventory(selectedSeed) <= 0"
            @click="handlePlant"
          >
            {{ acting ? '⏳ 播种中...' : '🌱 播种' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.animate-pulse-soft {
  animation: pulse-soft 2s ease-in-out infinite;
}
</style>
