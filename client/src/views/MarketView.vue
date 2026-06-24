<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue'
import { useMarketStore } from '../stores/market'
import { useCompanyStore } from '../stores/company'
import { useUserStore } from '../stores/user'
import OrderTable from './OrderTable.vue'
import SellModal from '../components/SellModal.vue'
import { ALL_CROPS, CATEGORY_ORDER, CATEGORY_LABELS, getCropsByCategory } from '../config/crops'
import type { CropCategory } from '../types'
import type { CropConfig } from '../config/crops'

const marketStore = useMarketStore()
const companyStore = useCompanyStore()
const userStore = useUserStore()

const showSellModal = ref(false)
const buyingIds = ref(new Set<number>())
const sellingToCompany = ref<Record<string, boolean>>({})
const sellAmounts = ref<Record<string, number>>({})

// MVP 5.2: 移动端底部 Sheet 状态
const showMobileSheet = ref(false)

// MVP 4.3: 使用共享配置
const cropsByCategory = computed(() => getCropsByCategory())

// 当前活跃作物配置
const activeCropConfig = computed(() => ALL_CROPS[marketStore.activeCrop])

// 当前活跃作物的对口企业
const activeCompany = computed(() => {
  if (!activeCropConfig.value) return null
  return companyStore.companies.find((c) => c.company_id === activeCropConfig.value!.companyId) ?? null
})

// 当前活跃作物的新闻
const activeNews = computed(() => {
  if (!activeCropConfig.value) return []
  return companyStore.companies
    .filter((c) => c.event && c.company_id === activeCropConfig.value!.companyId)
    .map((c) => c.event!.title)
})

// MVP 4.3: 使用 store 中已按作物过滤的盘口
const activeDepth = computed(() => marketStore.activeDepth)
const activeFloorPrice = computed(() => marketStore.activeFloorPrice)

// 种植成本锚点（基于当前作物的种子价）
const costAnchor = computed(() => {
  if (!activeCropConfig.value) return 0
  return activeCropConfig.value.baseSeedPrice
})

// 利润率
const profitMargin = computed(() => {
  if (!activeCropConfig.value || !activeCompany.value) return null
  const seedCost = costAnchor.value
  const revenue = activeCompany.value.buy_price * activeCropConfig.value.yield
  const profit = revenue - seedCost
  return { revenue, cost: seedCost, profit, isNegative: profit <= 0 }
})

// 手风琴折叠状态
const expandedCategories = ref<Set<CropCategory>>(new Set(['grain']))

function toggleCategory(cat: CropCategory) {
  const next = new Set(expandedCategories.value)
  if (next.has(cat)) next.delete(cat)
  else next.add(cat)
  expandedCategories.value = next
}

function selectCrop(cropId: string) {
  marketStore.setActiveCrop(cropId)
  // MVP 5.2: 移动端选择后自动关闭 Sheet
  showMobileSheet.value = false
}

onMounted(() => {
  marketStore.startPolling()
  companyStore.startPolling()
})

onUnmounted(() => {
  marketStore.stopPolling()
  companyStore.stopPolling()
})

async function handleBuy(orderId: number) {
  if (buyingIds.value.has(orderId)) return
  buyingIds.value = new Set([...buyingIds.value, orderId])
  try {
    await marketStore.buy(orderId)
  } catch {
    // error 已在 store 中记录
  } finally {
    const next = new Set(buyingIds.value)
    next.delete(orderId)
    buyingIds.value = next
  }
}

async function handleSellToCompany(companyId: string, item: string) {
  const amount = sellAmounts.value[item]
  if (!amount || amount <= 0) return
  if (sellingToCompany.value[companyId]) return

  sellingToCompany.value = { ...sellingToCompany.value, [companyId]: true }
  try {
    await companyStore.sell(item, amount)
    sellAmounts.value[item] = 0
    await userStore.fetchUserInfo()
  } catch {
    // error handled in store
  } finally {
    sellingToCompany.value = { ...sellingToCompany.value, [companyId]: false }
  }
}

function getItemInventory(item: string): number {
  return userStore.items[item] ?? 0
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 h-full pb-16 lg:pb-0">
    <!-- ===== PC 左侧边栏：自选股列表（5 分类手风琴） ===== -->
    <div class="hidden lg:block lg:col-span-1 bg-slate-800/50 border border-slate-700 rounded-xl p-3 overflow-y-auto max-h-[calc(100vh-12rem)] sidebar-scroll">
      <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">📋 自选股列表</h3>

      <div v-for="cat in CATEGORY_ORDER" :key="cat" class="mb-1">
        <!-- 分类标题（可点击折叠） -->
        <button
          class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
          :class="expandedCategories.has(cat)
            ? 'bg-slate-700/40 text-slate-200'
            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20'"
          @click="toggleCategory(cat)"
        >
          <span>{{ CATEGORY_LABELS[cat] }}</span>
          <span class="text-slate-500 text-[10px] transition-transform duration-200"
            :class="expandedCategories.has(cat) ? 'rotate-180' : ''"
          >▼</span>
        </button>

        <!-- 分类下的作物列表 -->
        <Transition name="accordion">
          <div v-if="expandedCategories.has(cat)" class="ml-1 space-y-0.5 mt-0.5">
            <button
              v-for="crop in cropsByCategory[cat]"
              :key="crop.id"
              class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200"
              :class="marketStore.activeCrop === crop.id
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/20 border border-transparent'"
              @click="selectCrop(crop.id)"
            >
              <span class="text-sm">{{ crop.emoji }}</span>
              <span class="flex-1 text-left">{{ crop.name }}</span>
              <span class="text-[10px] text-slate-500 font-mono">{{ crop.totalTimeMin }}min</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- ===== 右侧主屏：深度交易区 ===== -->
    <div class="lg:col-span-4 space-y-4">
      <!-- ===== MVP 5.2: 移动端资产切换器 ===== -->
      <div class="lg:hidden">
        <button
          class="w-full flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 active:scale-[0.98] transition-all duration-200"
          @click="showMobileSheet = true"
        >
          <span class="text-2xl">{{ activeCropConfig?.emoji ?? '🌽' }}</span>
          <div class="flex-1 text-left">
            <div class="text-sm font-semibold text-slate-100">{{ activeCropConfig?.name ?? '玉米' }}</div>
            <div class="text-[10px] text-slate-500">点击切换交易对</div>
          </div>
          <span class="text-slate-400 text-lg">▼</span>
        </button>
      </div>

      <!-- 当前活跃作物标题栏 -->
      <div v-if="activeCropConfig" class="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl hidden lg:inline">{{ activeCropConfig.emoji }}</span>
            <div>
              <h2 class="text-lg font-bold text-slate-100">{{ activeCropConfig.name }}</h2>
              <div class="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span>⏱ {{ formatTime(activeCropConfig.totalTimeMin) }}</span>
                <span>📦 产量 ×{{ activeCropConfig.yield }}</span>
                <span>🌱 🪙{{ activeCropConfig.baseSeedPrice }}</span>
                <span>📊 ×{{ getItemInventory(activeCropConfig.id) }}</span>
              </div>
            </div>
          </div>
          <!-- PC 端挂单按钮 -->
          <button
            class="hidden lg:inline-block text-sm px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all duration-200 active:scale-95 font-medium"
            @click="showSellModal = true"
          >
            📦 挂单
          </button>
        </div>
      </div>

      <!-- 企业收购面板（只显示当前作物的对口企业） -->
      <div v-if="activeCompany" class="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ activeCompany.emoji }}</span>
            <div>
              <h3 class="text-sm font-semibold text-slate-200">{{ activeCompany.name }}</h3>
              <p class="text-xs text-slate-400">{{ activeCompany.description }}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold font-mono tabular-nums"
              :class="activeCompany.event ? 'text-yellow-400' : 'text-green-400'"
            >🪙 {{ activeCompany.buy_price }}</div>
            <div class="text-[10px] text-slate-500">/ 颗</div>
            <!-- 利润率 -->
            <div v-if="profitMargin" class="text-xs mt-1"
              :class="profitMargin.isNegative ? 'text-red-400' : 'text-emerald-400'"
            >
              利润率 {{ profitMargin.isNegative ? '' : '+' }}{{ profitMargin.profit > 0 ? ((profitMargin.profit / profitMargin.cost) * 100).toFixed(0) : profitMargin.profit }}%
            </div>
          </div>
        </div>
        <!-- 事件提示 -->
        <div v-if="activeCompany.event" class="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
          📰 {{ activeCompany.event.title }}
        </div>
        <!-- PC 端快速出售 -->
        <div class="hidden lg:flex mt-3 items-center gap-2">
          <input
            v-model.number="sellAmounts[activeCropConfig!.id]"
            type="number"
            min="1"
            :max="getItemInventory(activeCropConfig!.id)"
            class="w-20 px-2 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
            placeholder="数量"
          />
          <button
            class="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
            :class="sellingToCompany[activeCompany.company_id]
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95'"
            :disabled="sellingToCompany[activeCompany.company_id]"
            @click="handleSellToCompany(activeCompany.company_id, activeCropConfig!.id)"
          >
            {{ sellingToCompany[activeCompany.company_id] ? '⏳' : '💰 直售' }}
          </button>
        </div>
      </div>

      <!-- 新闻跑马灯（只显示当前作物的新闻） -->
      <div v-if="activeNews.length > 0" class="bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-2 overflow-hidden">
        <div class="flex items-center gap-2 text-xs text-yellow-400 animate-pulse-soft">
          <span>📰</span>
          <span class="whitespace-nowrap">{{ activeNews[0] }}</span>
        </div>
      </div>

      <!-- 盘口深度 + 挂单面板 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- 盘口深度 -->
        <div class="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">📊 盘口深度</h3>
          <OrderTable
            :depth="activeDepth"
            :floor-price="activeFloorPrice"
            :user-id="userStore.userId"
            :buying-ids="buyingIds"
            @buy="handleBuy"
          />
        </div>

        <!-- 我的挂单 -->
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 class="text-sm font-semibold text-slate-300 mb-3">📋 我的挂单</h3>
          <div v-if="marketStore.myOrders.length === 0" class="text-center py-8 text-slate-500">
            <div class="text-2xl mb-1">📭</div>
            <p class="text-xs">暂无挂单</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="order in marketStore.myOrders"
              :key="order.id"
              class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/20 text-xs"
            >
              <div>
                <span class="text-slate-300 font-mono">🪙 {{ order.unit_price }}</span>
                <span class="text-slate-500 ml-2">×{{ order.amount }}</span>
              </div>
              <div class="text-slate-400 font-mono">
                🪙 {{ order.total_price }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== MVP 5.2: 移动端粘性底部操作栏 ===== -->
  <div class="lg:hidden sticky bottom-0 -mx-4 px-4 py-3 bg-slate-800/95 backdrop-blur-md border-t border-slate-700/50 safe-area-bottom">
    <div class="flex items-center gap-3">
      <button
        class="flex-1 text-sm font-medium py-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 active:scale-[0.97] transition-all duration-200"
        @click="showSellModal = true"
      >
        📦 挂单卖出
      </button>
      <button
        v-if="activeCompany"
        class="flex-1 text-sm font-medium py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-[0.97] transition-all duration-200"
        :disabled="sellingToCompany[activeCompany.company_id]"
        @click="handleSellToCompany(activeCompany.company_id, activeCropConfig!.id)"
      >
        {{ sellingToCompany[activeCompany.company_id] ? '⏳ 出售中...' : '💰 直售给' + activeCompany.emoji }}
      </button>
    </div>
  </div>

  <!-- ===== MVP 5.2: 移动端 Bottom Sheet 作物选择器 ===== -->
  <Teleport to="body">
    <div v-if="showMobileSheet" class="fixed inset-0 z-50 lg:hidden">
      <!-- 背景 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showMobileSheet = false" />

      <!-- Bottom Sheet -->
      <div class="absolute bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col animate-slide-up">
        <!-- 拖拽指示条 -->
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        <!-- 标题 -->
        <div class="flex items-center justify-between px-5 py-2">
          <h3 class="text-sm font-bold text-slate-100">📋 选择交易对</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="showMobileSheet = false"
          >✕</button>
        </div>

        <!-- 分类 Tab -->
        <div class="flex gap-1 px-4 py-2 overflow-x-auto border-b border-slate-700/30">
          <button
            v-for="cat in CATEGORY_ORDER"
            :key="cat"
            class="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            :class="expandedCategories.has(cat)
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="toggleCategory(cat)"
          >
            {{ CATEGORY_LABELS[cat] }}
          </button>
        </div>

        <!-- 作物列表 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-1">
          <div
            v-for="cat in CATEGORY_ORDER"
            :key="cat"
          >
            <div v-if="expandedCategories.has(cat)" class="space-y-1">
              <button
                v-for="crop in cropsByCategory[cat]"
                :key="crop.id"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                :class="marketStore.activeCrop === crop.id
                  ? 'bg-blue-500/15 border border-blue-500/30'
                  : 'hover:bg-slate-700/30 border border-transparent'"
                @click="selectCrop(crop.id)"
              >
                <span class="text-xl">{{ crop.emoji }}</span>
                <div class="flex-1 text-left min-w-0">
                  <div class="text-sm font-medium text-slate-200">{{ crop.name }}</div>
                  <div class="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>⏱ {{ formatTime(crop.totalTimeMin) }}</span>
                    <span>📦 ×{{ crop.yield }}</span>
                  </div>
                </div>
                <span v-if="marketStore.activeCrop === crop.id" class="text-blue-400 text-sm">✓</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 挂单弹窗（MVP 4.3: 锁定当前交易对） -->
  <SellModal
    :show="showSellModal"
    :active-crop="marketStore.activeCrop"
    @close="showSellModal = false"
  />
</template>

<style scoped>
/* 自定义滚动条 */
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.3);
  border-radius: 2px;
}

/* 手风琴动画 */
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.2s ease;
}
.accordion-enter-from,
.accordion-leave-to {
  opacity: 0;
  max-height: 0;
}
.accordion-enter-to,
.accordion-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
