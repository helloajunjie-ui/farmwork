<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useFarmStore } from '../stores/farm'
import { useUserStore } from '../stores/user'
import PlotGrid from './PlotGrid.vue'
import FarmStats from './FarmStats.vue'
import { ALL_CROPS, CATEGORY_ORDER, CATEGORY_LABELS, getCropsByCategory } from '../config/crops'
import type { CropCategory } from '../types'

const farmStore = useFarmStore()
const userStore = useUserStore()
const buyingCow = ref(false)
const seedBuyAmount = ref(10)
const showSeedTerminal = ref(false)

// MVP 4.3: 使用共享配置
const seedsByCategory = computed(() => getCropsByCategory())

// MVP 5.1: 默认选中 wheat（10分钟极速作物），而非 corn（28分钟）
const activeCategory = ref<CropCategory>('grain')
const selectedSeedCrop = ref('wheat')

// 当前选中作物的详细信息
const selectedSeedInfo = computed(() => ALL_CROPS[selectedSeedCrop.value])

// 当前种子价（使用基础价作为 fallback）
const currentSeedPrice = computed(() => {
  return selectedSeedInfo.value?.baseSeedPrice ?? 2
})

// 极限利润率计算
const profitMargin = computed(() => {
  const opt = selectedSeedInfo.value
  if (!opt) return { revenue: 0, cost: 0, profit: 0, isNegative: false }

  const seedCost = currentSeedPrice.value
  const revenue = opt.baseSellPrice * opt.yield
  const profit = revenue - seedCost
  return {
    revenue,
    cost: seedCost,
    profit,
    isNegative: profit <= 0,
  }
})

// 打工牛条件
const showCowEntry = computed(() => {
  if (farmStore.cowStatus.has_cow) return true
  if (farmStore.loading) return false
  return userStore.gold > 1000 || farmStore.unlockedNewPlots >= 2
})

onMounted(async () => {
  await Promise.all([
    farmStore.fetchPlots(),
    farmStore.fetchCowStatus(),
  ])
  farmStore.startTick()
})

onUnmounted(() => {
  farmStore.stopTick()
})

async function handleBuyCow() {
  buyingCow.value = true
  try {
    await farmStore.buyCow()
  } catch {
    // error 已由 store 管理
  } finally {
    buyingCow.value = false
  }
}

async function handleBuySeed() {
  try {
    await farmStore.buySeed(seedBuyAmount.value, selectedSeedCrop.value)
  } catch {
    // error 已由 store 管理
  }
}

function setSeedAmount(amount: number) {
  seedBuyAmount.value = amount
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}
</script>

<template>
  <div class="space-y-4 pb-24 lg:pb-0">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-100">🏠 我的农场</h2>
      <FarmStats />
    </div>

    <!-- 种子站快捷栏 -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-300">🌱 种子站</h3>
        <button
          class="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all duration-200 active:scale-95 font-medium"
          @click="showSeedTerminal = true"
        >
          📋 采购终端
        </button>
      </div>

      <!-- 当前选中作物快速信息 -->
      <div v-if="selectedSeedInfo" class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/20">
        <div class="flex items-center gap-2">
          <span class="text-lg">{{ selectedSeedInfo.emoji }}</span>
          <div>
            <span class="text-sm font-medium text-slate-200">{{ selectedSeedInfo.name }}</span>
            <span class="text-[10px] text-slate-500 ml-2">⏱ {{ formatTime(selectedSeedInfo.totalTimeMin) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-4 text-xs">
          <span class="text-slate-400">🌱 🪙{{ currentSeedPrice }}</span>
          <span class="font-mono tabular-nums"
            :class="profitMargin.isNegative ? 'text-red-400' : 'text-emerald-400'"
          >
            {{ profitMargin.isNegative ? '' : '+' }}{{ profitMargin.profit > 0 ? ((profitMargin.profit / profitMargin.cost) * 100).toFixed(0) : profitMargin.profit }}%
          </span>
          <div class="hidden lg:flex items-center gap-1">
            <button
              v-for="n in [10, 50, 100]"
              :key="n"
              class="px-2 py-1 rounded text-[10px] font-medium transition-all duration-200"
              :class="seedBuyAmount === n
                ? 'bg-blue-500/30 text-blue-300'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700/70'"
              @click="setSeedAmount(n)"
            >×{{ n }}</button>
          </div>
          <button
            class="px-3 py-1.5 rounded-lg font-medium transition-all duration-200 text-xs"
            :class="farmStore.loading
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95'"
            :disabled="farmStore.loading"
            @click="handleBuySeed"
          >
            🛒 采购 🪙{{ currentSeedPrice * seedBuyAmount }}
          </button>
        </div>
      </div>
    </div>

    <!-- 农场网格 -->
    <PlotGrid />

    <!-- 打工牛 -->
    <div v-if="showCowEntry" class="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🐄</span>
          <div>
            <h3 class="text-sm font-semibold text-slate-200">打工牛</h3>
            <p class="text-xs text-slate-400">
              {{ farmStore.cowStatus.has_cow
                ? farmStore.cowStatus.active ? '🟢 自动播种中' : '🔴 未激活'
                : '自动播种，解放双手' }}
            </p>
          </div>
        </div>
        <button
          v-if="!farmStore.cowStatus.has_cow"
          class="text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200"
          :class="buyingCow
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 active:scale-95'"
          :disabled="buyingCow"
          @click="handleBuyCow"
        >
          {{ buyingCow ? '⏳ 购买中...' : '🐄 购买（🪙500）' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ===== MVP 5.2: 采购终端 Bottom Sheet (移动端) / 全屏模态框 (PC) ===== -->
  <Teleport to="body">
    <div v-if="showSeedTerminal" class="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <!-- 背景 -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showSeedTerminal = false" />

      <!-- PC: 全屏模态框 -->
      <div class="hidden lg:flex relative bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[85vh] flex-col">
        <!-- 标题 -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 class="text-base font-bold text-slate-100">📋 大宗商品采购终端</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="showSeedTerminal = false"
          >✕</button>
        </div>

        <!-- 分类 Tab -->
        <div class="flex gap-1 px-5 py-2.5 border-b border-slate-700/30 overflow-x-auto">
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
        <div class="flex-1 overflow-y-auto p-5 space-y-2">
          <div
            v-for="seed in seedsByCategory[activeCategory]"
            :key="seed.id"
            class="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200"
            :class="selectedSeedCrop === seed.id
              ? 'bg-blue-500/15 border border-blue-500/30'
              : 'hover:bg-slate-700/30 border border-transparent'"
            @click="selectedSeedCrop = seed.id"
          >
            <span class="text-xl">{{ seed.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-200">{{ seed.name }}</div>
              <div class="text-[10px] text-slate-500 flex items-center gap-3 mt-0.5">
                <span>⏱ {{ formatTime(seed.totalTimeMin) }}</span>
                <span>📦 产量 ×{{ seed.yield }}</span>
                <span>🏢 {{ seed.companyEmoji }} {{ seed.companyName }}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-mono tabular-nums text-slate-300">🪙 {{ seed.baseSeedPrice }}</div>
              <div class="text-[10px] font-mono tabular-nums mt-0.5"
                :class="seed.baseSellPrice * seed.yield - seed.baseSeedPrice > 0 ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ seed.baseSellPrice * seed.yield - seed.baseSeedPrice > 0 ? '+' : '' }}{{ ((seed.baseSellPrice * seed.yield - seed.baseSeedPrice) / seed.baseSeedPrice * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
          <div v-if="selectedSeedInfo" class="flex items-center gap-3 text-xs text-slate-400">
            <span>{{ selectedSeedInfo.emoji }} {{ selectedSeedInfo.name }}</span>
            <span class="font-mono">🪙 {{ currentSeedPrice }}/颗</span>
            <span class="font-mono">合计 🪙 {{ currentSeedPrice * seedBuyAmount }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 mr-2">
              <button
                v-for="n in [10, 50, 100]"
                :key="n"
                class="px-2.5 py-1.5 rounded text-[10px] font-medium transition-all duration-200"
                :class="seedBuyAmount === n
                  ? 'bg-blue-500/30 text-blue-300'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700/70'"
                @click="setSeedAmount(n)"
              >×{{ n }}</button>
            </div>
            <button
              class="text-sm font-medium px-5 py-2 rounded-lg transition-all duration-200"
              :class="farmStore.loading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95'"
              :disabled="farmStore.loading"
              @click="handleBuySeed"
            >
              🛒 采购
            </button>
          </div>
        </div>
      </div>

      <!-- 移动端: Bottom Sheet -->
      <div class="lg:hidden relative bg-slate-800 border-t border-slate-700 rounded-t-2xl w-full shadow-2xl max-h-[80vh] flex flex-col animate-slide-up">
        <!-- 拖拽指示条 -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        <!-- 标题 -->
        <div class="flex items-center justify-between px-5 py-2">
          <h3 class="text-sm font-bold text-slate-100">📋 采购终端</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="showSeedTerminal = false"
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
            :class="selectedSeedCrop === seed.id
              ? 'bg-blue-500/15 border border-blue-500/30'
              : 'hover:bg-slate-700/30 border border-transparent'"
            @click="selectedSeedCrop = seed.id"
          >
            <span class="text-xl">{{ seed.emoji }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-slate-200">{{ seed.name }}</div>
              <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>⏱ {{ formatTime(seed.totalTimeMin) }}</span>
                <span>📦 ×{{ seed.yield }}</span>
                <span>🏢 {{ seed.companyEmoji }}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-mono tabular-nums text-slate-300">🪙 {{ seed.baseSeedPrice }}</div>
              <div class="text-[10px] font-mono tabular-nums mt-0.5"
                :class="seed.baseSellPrice * seed.yield - seed.baseSeedPrice > 0 ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ seed.baseSellPrice * seed.yield - seed.baseSeedPrice > 0 ? '+' : '' }}{{ ((seed.baseSellPrice * seed.yield - seed.baseSeedPrice) / seed.baseSeedPrice * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏（粘性） -->
        <div class="sticky bottom-0 px-5 py-3 border-t border-slate-700/50 bg-slate-800 flex items-center justify-between safe-area-bottom">
          <div v-if="selectedSeedInfo" class="text-xs text-slate-400">
            <span class="font-mono">🪙 {{ currentSeedPrice * seedBuyAmount }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <button
                v-for="n in [10, 50, 100]"
                :key="n"
                class="px-2.5 py-1.5 rounded text-[10px] font-medium transition-all duration-200"
                :class="seedBuyAmount === n
                  ? 'bg-blue-500/30 text-blue-300'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700/70'"
                @click="setSeedAmount(n)"
              >×{{ n }}</button>
            </div>
            <button
              class="text-sm font-medium px-5 py-2.5 rounded-xl transition-all duration-200"
              :class="farmStore.loading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95'"
              :disabled="farmStore.loading"
              @click="handleBuySeed"
            >
              🛒 采购
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
