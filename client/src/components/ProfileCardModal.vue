<script setup lang="ts">
import { ref, watch } from 'vue'
import { fetchProfile } from '../api'
import { formatGold } from '../utils/format'
import type { ProfileData } from '../types'

const props = defineProps<{
  show: boolean
  username: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const profile = ref<ProfileData | null>(null)
const loading = ref(false)
const error = ref('')

watch(
  () => props.show,
  async (val) => {
    if (val && props.username) {
      loading.value = true
      error.value = ''
      profile.value = null
      try {
        profile.value = await fetchProfile(props.username)
      } catch (e: any) {
        error.value = e?.message || '获取名片失败'
      } finally {
        loading.value = false
      }
    }
  }
)

function getTierColor(tier: number): string {
  if (tier <= 3) return 'from-slate-700/80 to-slate-600/80 border-slate-500'
  if (tier <= 6) return 'from-amber-900/80 to-amber-800/80 border-amber-600'
  if (tier <= 9) return 'from-yellow-900/80 to-yellow-800/80 border-yellow-500'
  if (tier <= 13) return 'from-purple-900/80 to-purple-800/80 border-purple-400'
  if (tier <= 16) return 'from-cyan-900/80 to-cyan-800/80 border-cyan-400'
  if (tier <= 19) return 'from-rose-900/80 to-rose-800/80 border-rose-400'
  return 'from-yellow-900/90 to-amber-900/90 border-yellow-300'
}

function getGlowStyle(tier: number): string {
  if (tier <= 3) return 'shadow-slate-500/20'
  if (tier <= 6) return 'shadow-amber-500/20'
  if (tier <= 9) return 'shadow-yellow-500/20'
  if (tier <= 13) return 'shadow-purple-500/20'
  if (tier <= 16) return 'shadow-cyan-500/20'
  if (tier <= 19) return 'shadow-rose-500/20'
  return 'shadow-yellow-300/30'
}
</script>

<template>
  <!-- 遮罩层 -->
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <!-- 背景模糊 -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <!-- 名片卡片 -->
      <div
        v-if="!loading && profile"
        class="relative w-full max-w-sm rounded-2xl border overflow-hidden transition-all duration-500 animate-fade-in"
        :class="[getTierColor(profile.housing_tier), getGlowStyle(profile.housing_tier)]"
        style="box-shadow: 0 0 40px -10px currentColor;"
      >
        <!-- 顶部装饰光效 -->
        <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <!-- 头像 + 昵称 -->
        <div class="pt-8 pb-4 px-6 text-center">
          <div class="w-16 h-16 mx-auto rounded-full bg-slate-700/50 border-2 border-white/10 flex items-center justify-center text-2xl mb-3 backdrop-blur-sm">
            {{ profile.avatar_url ? '🖼️' : profile.nickname.charAt(0) }}
          </div>
          <h2 class="text-xl font-bold text-white tracking-wide">{{ profile.nickname }}</h2>
          <span
            class="inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm"
            :class="profile.housing.color.replace('border-', 'bg-').replace(/\d+$/, '/20') + ' text-white/80'"
          >
            {{ profile.housing.badge }}
          </span>
        </div>

        <!-- 房产展示区 -->
        <div class="px-6 py-4 text-center">
          <div class="text-5xl mb-2">{{ profile.housing.emoji }}</div>
          <h3 class="text-lg font-bold text-white">{{ profile.housing.name }}</h3>
          <p class="text-sm text-white/60 mt-1 italic leading-relaxed">
            "{{ profile.housing.description }}"
          </p>
        </div>

        <!-- 分隔线 -->
        <div class="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <!-- 资产数据 -->
        <div class="px-6 py-4 grid grid-cols-2 gap-3">
          <div class="text-center">
            <div class="text-xs text-white/50 mb-1">预估总净值</div>
            <div class="text-sm font-bold text-amber-400 font-mono tabular-nums">
              {{ formatGold(profile.net_worth) }}
            </div>
          </div>
          <div class="text-center">
            <div class="text-xs text-white/50 mb-1">拥有土地</div>
            <div class="text-sm font-bold text-white font-mono tabular-nums">
              🏞️ {{ profile.unlocked_plots }}
            </div>
          </div>
        </div>

        <!-- 累计投入 -->
        <div class="px-6 pb-6 text-center">
          <div class="text-xs text-white/40">累计房产投入</div>
          <div class="text-sm text-white/70 font-mono tabular-nums mt-0.5">
            {{ formatGold(profile.housing.total_cost) }}
          </div>
        </div>

        <!-- 关闭按钮 -->
        <button
          class="w-full py-3 text-sm text-white/50 hover:text-white/80 transition-colors bg-black/10 hover:bg-black/20 backdrop-blur-sm"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>

      <!-- 加载状态 -->
      <div
        v-else-if="loading"
        class="relative w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-800/90 backdrop-blur-xl p-8 animate-pulse"
      >
        <div class="w-16 h-16 mx-auto rounded-full bg-slate-700 mb-4" />
        <div class="h-5 w-24 mx-auto bg-slate-700 rounded mb-3" />
        <div class="h-3 w-32 mx-auto bg-slate-700 rounded mb-6" />
        <div class="h-16 w-16 mx-auto bg-slate-700 rounded-full mb-4" />
        <div class="h-4 w-36 mx-auto bg-slate-700 rounded mb-2" />
        <div class="h-3 w-48 mx-auto bg-slate-700 rounded" />
      </div>

      <!-- 错误状态 -->
      <div
        v-else-if="error"
        class="relative w-full max-w-sm rounded-2xl border border-red-500/30 bg-slate-800/90 backdrop-blur-xl p-8 text-center"
      >
        <div class="text-4xl mb-3">😵</div>
        <p class="text-red-400 text-sm">{{ error }}</p>
        <button
          class="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
          @click="emit('close')"
        >
          关闭
        </button>
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
