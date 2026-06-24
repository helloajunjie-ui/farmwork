<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'
import { ALL_CROPS } from '../config/crops'
import { formatGold, formatAmount, formatGoldCompact } from '../utils/format'
import { getHousingTier, getNextHousingTier } from '../config/housing'
import { upgradeHouse } from '../api'
import ReadonlyFarmModal from '../components/ReadonlyFarmModal.vue'
import MailComposeModal from '../components/MailComposeModal.vue'
import MailboxModal from '../components/MailboxModal.vue'

const userStore = useUserStore()
const router = useRouter()
const loggingOut = ref(false)
const upgrading = ref(false)
const upgradeMsg = ref('')
const upgradeError = ref('')

// MVP 8.0: 信箱 + 窥探状态
const showMailbox = ref(false)
const showReadonlyFarm = ref(false)
const readonlyFarmUsername = ref('')
const showComposeMail = ref(false)
const composeTarget = ref('')

// 当前房产信息
const currentHousing = computed(() => getHousingTier(userStore.housingTier ?? 1))
const nextHousing = computed(() => getNextHousingTier(userStore.housingTier ?? 1))

// 计算总净值（前端估算，精确值由后端排行榜提供）
const estimatedNetWorth = computed(() => {
  let total = userStore.gold
  total += (userStore.upkeep.unlocked_plots || 6) * 1000
  for (const [item, amount] of Object.entries(userStore.items)) {
    if (item === 'seed' || amount <= 0) continue
    const crop = ALL_CROPS[item]
    if (crop) {
      total += amount * crop.baseSellPrice
    }
  }
  return total
})

// 所属阶级
const playerClass = computed(() => {
  const plots = userStore.upkeep.unlocked_plots || 6
  if (plots > 6) return { label: '🎩 资本巨鳄', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' }
  return { label: '👨‍🌾 农夫新星', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' }
})

// 有库存的作物列表（排除种子）
const inventoryItems = computed(() => {
  return Object.entries(userStore.items)
    .filter(([k, v]) => k !== 'seed' && v > 0)
    .map(([item, amount]) => {
      const crop = ALL_CROPS[item]
      return {
        item,
        name: crop?.name ?? item,
        emoji: crop?.emoji ?? '📦',
        amount,
        value: amount * (crop?.baseSellPrice ?? 0),
      }
    })
    .sort((a, b) => b.value - a.value)
})

// 流动资金占比
const liquidityRatio = computed(() => {
  const netWorth = estimatedNetWorth.value
  if (netWorth <= 0) return 0.5
  return Math.min(1, userStore.gold / netWorth)
})

function handleLogout() {
  loggingOut.value = true
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  router.push('/login')
}

async function handleUpgrade() {
  if (!nextHousing.value || upgrading.value) return
  upgrading.value = true
  upgradeMsg.value = ''
  upgradeError.value = ''
  try {
    await upgradeHouse()
    upgradeMsg.value = `🎉 升级成功！`
    // 刷新用户信息
    await userStore.fetchUserInfo()
  } catch (e: any) {
    upgradeError.value = e?.message || '升级失败'
  } finally {
    upgrading.value = false
  }
}
</script>

<template>
  <div class="space-y-4 pb-24 lg:pb-0">
    <!-- 页面标题 + 信箱入口 -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-bold text-slate-100">🏢 仓储中心</h2>
      <button
        class="text-sm text-rose-400/70 hover:text-rose-300 transition-colors flex items-center gap-1"
        @click="showMailbox = true"
      >
        📮 信箱
      </button>
    </div>

    <!-- 玩家信息 + 阶级徽章 -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div class="flex items-center gap-4">
        <div class="w-14 h-14 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xl select-none">
          {{ userStore.nickname ? userStore.nickname.charAt(0) : '?' }}
        </div>
        <div class="flex-1">
          <h3 class="text-base font-semibold text-slate-100">{{ userStore.nickname || '加载中...' }}</h3>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs font-mono tabular-nums text-slate-400">{{ formatGold(userStore.gold) }}</span>
          </div>
        </div>
        <!-- 阶级徽章 -->
        <div class="text-xs px-3 py-1.5 rounded-lg font-medium border" :class="playerClass.bg + ' ' + playerClass.color">
          {{ playerClass.label }}
        </div>
      </div>

      <!-- 总净值 -->
      <div class="mt-4 px-4 py-3 rounded-xl bg-slate-700/20">
        <div class="text-[10px] text-slate-500 mb-1">📊 预估总净值</div>
        <div class="text-xl font-bold font-mono tabular-nums text-slate-100">
          {{ formatGold(estimatedNetWorth) }}
        </div>
        <!-- 资产结构进度条 -->
        <div class="mt-3">
          <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>💧 流动资金</span>
            <span>📦 大宗存货</span>
          </div>
          <div class="h-2 rounded-full bg-slate-700 overflow-hidden flex">
            <div
              class="h-full rounded-full transition-all duration-500 bg-blue-500"
              :style="{ width: `${liquidityRatio * 100}%` }"
            />
            <div
              class="h-full rounded-full transition-all duration-500 bg-emerald-500"
              :style="{ width: `${(1 - liquidityRatio) * 100}%` }"
            />
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-600 mt-1">
            <span class="font-mono">{{ formatGold(userStore.gold) }}</span>
            <span class="font-mono">{{ formatGold(estimatedNetWorth - userStore.gold) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MVP 8.1: 房产资产 + 双重计价 -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-slate-300 mb-3">🏠 房产资产</h3>

      <div class="flex items-center gap-4 px-3 py-3 rounded-xl bg-slate-700/10">
        <div class="text-3xl">{{ currentHousing.emoji }}</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold text-slate-100">{{ currentHousing.name }}</div>
          <!-- MVP 8.1: 金色现实估值 -->
          <div
            v-if="currentHousing.fiatValue"
            class="mt-0.5 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent font-bold text-sm tracking-wide"
          >
            💎 {{ currentHousing.fiatValue }}
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">{{ currentHousing.badge }}</div>
          <div class="text-[10px] text-slate-600 mt-0.5 italic">"{{ currentHousing.description }}"</div>
        </div>
      </div>

      <!-- 升级入口 -->
      <div v-if="nextHousing" class="mt-3">
        <div class="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>下一阶: {{ nextHousing.emoji }} {{ nextHousing.name }}</span>
          <span class="font-mono tabular-nums">{{ formatGold(nextHousing.cost) }}</span>
        </div>

        <!-- 升级按钮 -->
        <button
          class="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]"
          :class="userStore.gold >= nextHousing.cost
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
            : 'bg-slate-700/30 text-slate-500 border border-slate-700 cursor-not-allowed'"
          :disabled="upgrading || userStore.gold < nextHousing.cost"
          @click="handleUpgrade"
        >
          {{ upgrading ? '⏳ 升级中...' : `耗费 ${formatGoldCompact(nextHousing.cost)} 🪙 升级` }}
        </button>

        <!-- 升级反馈 -->
        <p v-if="upgradeMsg" class="mt-2 text-xs text-green-400 text-center">{{ upgradeMsg }}</p>
        <p v-else-if="upgradeError" class="mt-2 text-xs text-red-400 text-center">{{ upgradeError }}</p>
      </div>

      <!-- 满级 -->
      <div v-else class="mt-3 text-center py-3">
        <span class="text-xs text-yellow-400">👑 已登顶！你是全服唯一的传说</span>
      </div>
    </div>

    <!-- 资产概览卡片 -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
        <div class="text-lg mb-1">🏞️</div>
        <div class="text-sm font-bold font-mono text-slate-200">{{ userStore.upkeep.unlocked_plots || 6 }}</div>
        <div class="text-[10px] text-slate-500">地块</div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
        <div class="text-lg mb-1">🌱</div>
        <div class="text-sm font-bold font-mono text-slate-200">{{ (userStore.items['seed'] ?? 0).toLocaleString() }}</div>
        <div class="text-[10px] text-slate-500">种子</div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-center">
        <div class="text-lg mb-1">📦</div>
        <div class="text-sm font-bold font-mono text-slate-200">{{ inventoryItems.length }}</div>
        <div class="text-[10px] text-slate-500">品类</div>
      </div>
    </div>

    <!-- 仓储卡片列表 -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-slate-300 mb-3">📦 大宗存货</h3>

      <div v-if="inventoryItems.length === 0" class="text-center py-8 text-slate-500">
        <div class="text-2xl mb-1">🏭</div>
        <p class="text-xs">仓库空空如也，快去耕种吧</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="inv in inventoryItems"
          :key="inv.item"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-700/10 hover:bg-slate-700/20 transition-all duration-200"
        >
          <span class="text-lg">{{ inv.emoji }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-200">{{ inv.name }}</span>
              <span class="text-xs font-mono tabular-nums text-slate-300">{{ formatAmount(inv.amount) }}</span>
            </div>
            <!-- 容量进度条 -->
            <div class="mt-1.5 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                class="h-full rounded-full bg-blue-500/60 transition-all duration-500"
                :style="{ width: `${Math.min(100, (inv.amount / 10000) * 100)}%` }"
              />
            </div>
            <div class="flex items-center justify-between mt-0.5">
              <span class="text-[10px] text-slate-600">容量 {{ Math.min(100, Math.round((inv.amount / 10000) * 100)) }}%</span>
              <span class="text-[10px] font-mono tabular-nums text-slate-500">≈ {{ formatGold(inv.value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 退出登录 -->
    <button
      class="w-full text-sm px-4 py-3 rounded-xl border border-red-700/30 text-red-400 hover:bg-red-500/10 transition-all duration-200 active:scale-[0.98] font-medium"
      :disabled="loggingOut"
      @click="handleLogout"
    >
      {{ loggingOut ? '⏳ 断开连接...' : '🚪 断开连接' }}
    </button>
  </div>

  <!-- MVP 8.0: 信箱模态框 -->
  <MailboxModal
    :show="showMailbox"
    @close="showMailbox = false"
  />

  <!-- MVP 8.0: 窥探农场模态框 -->
  <ReadonlyFarmModal
    :show="showReadonlyFarm"
    :username="readonlyFarmUsername"
    @close="showReadonlyFarm = false"
    @send-mail="(username: string) => { showReadonlyFarm = false; composeTarget = username; showComposeMail = true }"
  />

  <!-- MVP 8.0: 投递密函模态框 -->
  <MailComposeModal
    :show="showComposeMail"
    :preset-receiver="composeTarget"
    @close="showComposeMail = false"
  />
</template>
