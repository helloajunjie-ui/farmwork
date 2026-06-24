import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Plot, CowStatus } from '../types'
import {
  fetchPlots as apiFetchPlots,
  plant as apiPlant,
  harvest as apiHarvest,
  unlockPlot as apiUnlockPlot,
  buyCow as apiBuyCow,
  fetchCowStatus as apiFetchCowStatus,
  buySeed as apiBuySeed,
} from '../api'
import { useUserStore } from './user'

export const useFarmStore = defineStore('farm', () => {
  const plots = ref<Plot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const cowStatus = ref<CowStatus>({ has_cow: false, active: false, last_sync_at: null })
  const unlocking = ref<Set<number>>(new Set())
  const buyingSeed = ref(false)

  // 已解锁的新土地数量（排除初始 6 块）
  const unlockedNewPlots = computed(() =>
    plots.value.filter((p) => p.status !== 'locked' && p.plot_id > 6).length
  )

  let tickTimer: ReturnType<typeof setInterval> | null = null

  async function fetchPlots() {
    loading.value = true
    try {
      plots.value = await apiFetchPlots()
    } finally {
      loading.value = false
    }
  }

  async function plant(plotId: number, crop: string) {
    error.value = null
    try {
      await apiPlant(plotId, crop)
      await fetchPlots()
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    } catch (e: any) {
      error.value = e.message ?? '播种失败'
      throw e
    }
  }

  async function harvest(plotId: number) {
    error.value = null
    try {
      const result = await apiHarvest(plotId)
      await fetchPlots()
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
      return result
    } catch (e: any) {
      error.value = e.message ?? '收割失败'
      throw e
    }
  }

  async function unlockPlot(plotId: number) {
    error.value = null
    unlocking.value.add(plotId)
    try {
      await apiUnlockPlot(plotId)
      await fetchPlots()
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    } catch (e: any) {
      error.value = e.message ?? '解锁失败'
      throw e
    } finally {
      unlocking.value.delete(plotId)
    }
  }

  async function buyCow() {
    error.value = null
    try {
      await apiBuyCow()
      await fetchCowStatus()
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    } catch (e: any) {
      error.value = e.message ?? '购买打工牛失败'
      throw e
    }
  }

  async function fetchCowStatus() {
    try {
      cowStatus.value = await apiFetchCowStatus()
    } catch {
      // 静默失败，不影响主流程
    }
  }

  async function buySeed(amount: number, crop?: string) {
    error.value = null
    buyingSeed.value = true
    try {
      await apiBuySeed(amount, crop)
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    } catch (e: any) {
      error.value = e.message ?? '购买种子失败'
      throw e
    } finally {
      buyingSeed.value = false
    }
  }

  // 本地倒计时引擎（仅前端展示，不依赖后端）
  function startTick() {
    stopTick()
    tickTimer = setInterval(() => {
      const t = Math.floor(Date.now() / 1000)
      plots.value.forEach((p) => {
        if (p.planted_at !== null && p.status === 'growing') {
          const elapsed = t - p.planted_at
          const remaining = Math.max(0, p.remaining_seconds - 1)
          p.remaining_seconds = remaining
          if (remaining === 0) {
            p.status = 'ready'
          }
        }
      })
    }, 1000)
  }

  function stopTick() {
    if (tickTimer !== null) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  return {
    plots,
    loading,
    error,
    cowStatus,
    unlocking,
    unlockedNewPlots,
    buyingSeed,
    fetchPlots,
    plant,
    harvest,
    unlockPlot,
    buyCow,
    fetchCowStatus,
    buySeed,
    startTick,
    stopTick,
  }
})
