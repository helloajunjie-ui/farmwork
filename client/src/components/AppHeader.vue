<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../stores/user'
import GoldDisplay from './GoldDisplay.vue'
import InventoryBadge from './InventoryBadge.vue'
import LeaderboardModal from './LeaderboardModal.vue'

const userStore = useUserStore()
const showLeaderboard = ref(false)
</script>

<template>
  <!-- ===== MVP 5.2: PC 端显示 Header，移动端隐藏 (由底部 TabBar 替代) ===== -->
  <header class="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 hidden lg:block">
    <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
      <!-- 左侧：玩家信息 -->
      <div class="flex items-center gap-3">
        <!-- 头像占位（预留图片扩展） -->
        <div class="w-9 h-9 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm select-none">
          {{ userStore.nickname ? userStore.nickname.charAt(0) : '?' }}
        </div>
        <div>
          <h1 class="text-sm font-semibold text-slate-100">{{ userStore.nickname || '加载中...' }}</h1>
          <GoldDisplay />
        </div>
      </div>

      <!-- 右侧：排行榜入口 + 库存 -->
      <div class="flex items-center gap-3">
        <button
          class="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-all duration-200 active:scale-95 font-medium"
          @click="showLeaderboard = true"
        >
          🏆 排行
        </button>
        <InventoryBadge />
      </div>
    </div>
  </header>

  <!-- 排行榜模态框 -->
  <LeaderboardModal :show="showLeaderboard" @close="showLeaderboard = false" />
</template>
