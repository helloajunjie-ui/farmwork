import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInfo, UpkeepInfo } from '../types'
import { fetchUserInfo as apiFetchUserInfo } from '../api'

export const useUserStore = defineStore('user', () => {
  const userId = ref(0)
  const nickname = ref('')
  const gold = ref(0)
  const items = ref<Record<string, number>>({})
  const avatarUrl = ref<string | null>(null)
  const loading = ref(false)

  // MVP 4.0: 资金链健康度
  const upkeep = ref<UpkeepInfo>({
    rate: 0,
    minutes_remaining: 999,
    unlocked_plots: 6,
    is_bankrupt: false,
  })

  // 是否显示资金链仪表盘（>10 块地）
  const showUpkeepWarning = computed(() => upkeep.value.unlocked_plots > 10)

  // 资金链健康度百分比（用于进度条）
  const healthPercent = computed(() => {
    if (upkeep.value.rate <= 0) return 100
    const maxMinutes = 60
    const pct = Math.min(100, Math.round((upkeep.value.minutes_remaining / maxMinutes) * 100))
    return Math.max(0, pct)
  })

  // 健康度颜色
  const healthColor = computed(() => {
    if (healthPercent.value >= 60) return 'text-green-400'
    if (healthPercent.value >= 30) return 'text-yellow-400'
    return 'text-red-400'
  })

  // 进度条颜色
  const healthBarColor = computed(() => {
    if (healthPercent.value >= 60) return 'bg-green-500'
    if (healthPercent.value >= 30) return 'bg-yellow-500'
    return 'bg-red-500'
  })

  // 是否刚触发破产（用于动画）
  const justBankrupted = ref(false)

  async function fetchUserInfo() {
    loading.value = true
    try {
      const data: UserInfo = await apiFetchUserInfo()
      userId.value = data.user_id
      nickname.value = data.nickname
      gold.value = data.gold
      items.value = data.items
      avatarUrl.value = data.avatar_url

      // MVP 4.0: 资金链健康度
      if (data.upkeep) {
        // 检测是否刚破产
        if (data.upkeep.is_bankrupt && !upkeep.value.is_bankrupt) {
          justBankrupted.value = true
          setTimeout(() => { justBankrupted.value = false }, 4000)
        }
        upkeep.value = data.upkeep
      }
    } finally {
      loading.value = false
    }
  }

  return {
    userId,
    nickname,
    gold,
    items,
    avatarUrl,
    loading,
    upkeep,
    showUpkeepWarning,
    healthPercent,
    healthColor,
    healthBarColor,
    justBankrupted,
    fetchUserInfo,
  }
})
