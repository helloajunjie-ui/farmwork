<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLeaderboardStore } from '../stores/leaderboard'
import { formatGoldCompact } from '../utils/format'
import ProfileCardModal from './ProfileCardModal.vue'
import ReadonlyFarmModal from './ReadonlyFarmModal.vue'
import MailComposeModal from './MailComposeModal.vue'

defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const leaderboardStore = useLeaderboardStore()
const activeTab = ref<'farmers' | 'capitalists'>('farmers')

// MVP 7.0: 点击名字弹出名片
const selectedUsername = ref<string | null>(null)
const showProfile = ref(false)

// MVP 8.0: 窥探 + 投递
const showReadonlyFarm = ref(false)
const readonlyFarmUsername = ref('')
const showComposeMail = ref(false)
const composeTarget = ref('')

function openProfile(username: string) {
  selectedUsername.value = username
  showProfile.value = true
}

function handleVisitFarm(username: string) {
  showProfile.value = false
  readonlyFarmUsername.value = username
  showReadonlyFarm.value = true
}

function handleSendMail(username: string) {
  showReadonlyFarm.value = false
  composeTarget.value = username
  showComposeMail.value = true
}

onMounted(() => {
  leaderboardStore.fetchLeaderboard()
})

function getRankStyle(rank: number): string {
  if (rank === 1) return 'text-yellow-300'
  if (rank === 2) return 'text-slate-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-slate-500'
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <!-- 背景 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

      <!-- PC: 居中模态框 -->
      <div class="hidden lg:flex relative bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex-col">
        <!-- 标题 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 class="text-base font-bold text-slate-100">🏆 福布斯榜</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="emit('close')"
          >✕</button>
        </div>

        <!-- Tab 切换 -->
        <div class="flex gap-1 px-4 py-2.5 border-b border-slate-700/30">
          <button
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeTab === 'farmers'
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeTab = 'farmers'"
          >
            👨‍🌾 农夫新星榜
          </button>
          <button
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeTab === 'capitalists'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeTab = 'capitalists'"
          >
            🎩 资本巨鳄榜
          </button>
        </div>

        <!-- 列表 -->
        <div class="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div v-if="leaderboardStore.loading" class="text-center py-12 text-slate-500">
            <div class="text-2xl mb-2 animate-pulse-soft">🏆</div>
            <p class="text-xs">计算中...</p>
          </div>

          <template v-else-if="activeTab === 'farmers' && leaderboardStore.farmers.length > 0">
            <div
              v-for="entry in leaderboardStore.farmers"
              :key="entry.user_id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-slate-700/20"
            >
              <div class="w-8 text-center text-sm font-bold font-mono" :class="getRankStyle(entry.rank)">
                {{ getRankEmoji(entry.rank) }}
              </div>
              <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs select-none">
                {{ entry.nickname.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <button
                  class="text-sm font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/30 truncate transition-colors"
                  @click="openProfile(entry.nickname)"
                >
                  {{ entry.nickname }}
                </button>
                <div class="text-[10px] text-slate-500">
                  🏞️ {{ entry.unlocked_plots }} 块地
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold font-mono tabular-nums text-green-400">
                  {{ formatGoldCompact(entry.net_worth) }}
                </div>
                <div class="text-[10px] text-slate-500">净值</div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'capitalists' && leaderboardStore.capitalists.length > 0">
            <div
              v-for="entry in leaderboardStore.capitalists"
              :key="entry.user_id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-slate-700/20"
            >
              <div class="w-8 text-center text-sm font-bold font-mono" :class="getRankStyle(entry.rank)">
                {{ getRankEmoji(entry.rank) }}
              </div>
              <div class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs select-none">
                {{ entry.nickname.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <button
                  class="text-sm font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/30 truncate transition-colors"
                  @click="openProfile(entry.nickname)"
                >
                  {{ entry.nickname }}
                </button>
                <div class="text-[10px] text-slate-500">
                  🏞️ {{ entry.unlocked_plots }} 块地
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold font-mono tabular-nums text-purple-400">
                  {{ formatGoldCompact(entry.net_worth) }}
                </div>
                <div class="text-[10px] text-slate-500">净值</div>
              </div>
            </div>
          </template>

          <div v-else class="text-center py-12 text-slate-500">
            <div class="text-2xl mb-2">📭</div>
            <p class="text-xs">暂无数据</p>
          </div>
        </div>

        <!-- 底部更新时间 -->
        <div class="px-5 py-2 border-t border-slate-700/30 text-[10px] text-slate-600 text-center">
          更新于 {{ new Date(leaderboardStore.updatedAt).toLocaleTimeString('zh-CN') }}
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
          <h3 class="text-base font-bold text-slate-100">🏆 福布斯榜</h3>
          <button
            class="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
            @click="emit('close')"
          >✕</button>
        </div>

        <!-- Tab 切换 -->
        <div class="flex gap-1 px-4 py-2 border-b border-slate-700/30">
          <button
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeTab === 'farmers'
              ? 'bg-green-500/20 text-green-300 border border-green-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeTab = 'farmers'"
          >
            👨‍🌾 农夫榜
          </button>
          <button
            class="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200"
            :class="activeTab === 'capitalists'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'text-slate-400 hover:text-slate-300 border border-transparent'"
            @click="activeTab = 'capitalists'"
          >
            🎩 资本榜
          </button>
        </div>

        <!-- 列表 -->
        <div class="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
          <div v-if="leaderboardStore.loading" class="text-center py-12 text-slate-500">
            <div class="text-2xl mb-2 animate-pulse-soft">🏆</div>
            <p class="text-xs">计算中...</p>
          </div>

          <template v-else-if="activeTab === 'farmers' && leaderboardStore.farmers.length > 0">
            <div
              v-for="entry in leaderboardStore.farmers"
              :key="entry.user_id"
              class="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-700/20"
            >
              <div class="w-8 text-center text-sm font-bold font-mono" :class="getRankStyle(entry.rank)">
                {{ getRankEmoji(entry.rank) }}
              </div>
              <div class="w-9 h-9 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm select-none">
                {{ entry.nickname.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <button
                  class="text-sm font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/30 truncate transition-colors"
                  @click="openProfile(entry.nickname)"
                >
                  {{ entry.nickname }}
                </button>
                <div class="text-[10px] text-slate-500">
                  🏞️ {{ entry.unlocked_plots }} 块地
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold font-mono tabular-nums text-green-400">
                  {{ formatGoldCompact(entry.net_worth) }}
                </div>
                <div class="text-[10px] text-slate-500">净值</div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'capitalists' && leaderboardStore.capitalists.length > 0">
            <div
              v-for="entry in leaderboardStore.capitalists"
              :key="entry.user_id"
              class="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-700/20"
            >
              <div class="w-8 text-center text-sm font-bold font-mono" :class="getRankStyle(entry.rank)">
                {{ getRankEmoji(entry.rank) }}
              </div>
              <div class="w-9 h-9 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-sm select-none">
                {{ entry.nickname.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <button
                  class="text-sm font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/30 truncate transition-colors"
                  @click="openProfile(entry.nickname)"
                >
                  {{ entry.nickname }}
                </button>
                <div class="text-[10px] text-slate-500">
                  🏞️ {{ entry.unlocked_plots }} 块地
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold font-mono tabular-nums text-purple-400">
                  {{ formatGoldCompact(entry.net_worth) }}
                </div>
                <div class="text-[10px] text-slate-500">净值</div>
              </div>
            </div>
          </template>

          <div v-else class="text-center py-12 text-slate-500">
            <div class="text-2xl mb-2">📭</div>
            <p class="text-xs">暂无数据</p>
          </div>
        </div>
      </div>
    </div>

    <!-- MVP 7.0: 名片弹窗 -->
    <ProfileCardModal
      :show="showProfile"
      :username="selectedUsername"
      @close="showProfile = false"
      @visit-farm="handleVisitFarm"
    />

    <!-- MVP 8.0: 窥探农场 -->
    <ReadonlyFarmModal
      :show="showReadonlyFarm"
      :username="readonlyFarmUsername"
      @close="showReadonlyFarm = false"
      @send-mail="handleSendMail"
    />

    <!-- MVP 8.0: 投递密函 -->
    <MailComposeModal
      :show="showComposeMail"
      :preset-receiver="composeTarget"
      @close="showComposeMail = false"
    />
  </Teleport>
</template>
