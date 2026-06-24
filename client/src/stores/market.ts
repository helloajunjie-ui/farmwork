import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import type { DepthItem, MyOrder, CropCategory } from '../types'
import {
  fetchOrderBook as apiFetchOrderBook,
  sell as apiSell,
  buy as apiBuy,
} from '../api'
import { useUserStore } from './user'

export const useMarketStore = defineStore('market', () => {
  const depth = ref<DepthItem[]>([])
  const floorPrice = ref<number | null>(null)
  const myOrders = ref<MyOrder[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // MVP 4.2: 当前选中的交易对
  const activeCrop = ref<string>('corn')

  // MVP 4.3: 按当前活跃作物过滤的盘口深度
  const activeDepth = computed(() => {
    // 后端已按 item_id 过滤，depth 已经是当前作物的数据
    return depth.value
  })

  // MVP 4.3: 按当前活跃作物过滤的 floorPrice
  const activeFloorPrice = computed(() => floorPrice.value)

  // SWR: 3 秒静默轮询
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchOrderBook(itemId?: string) {
    const isFirstLoad = depth.value.length === 0
    if (isFirstLoad) loading.value = true
    try {
      const data = await apiFetchOrderBook(itemId)
      depth.value = data.depth
      floorPrice.value = data.floor_price
      myOrders.value = data.my_orders
    } catch (e: any) {
      if (isFirstLoad) {
        error.value = e.message ?? '加载失败'
      }
    } finally {
      if (isFirstLoad) loading.value = false
    }
  }

  function startPolling() {
    stopPolling()
    // MVP 4.3: 传入当前活跃作物
    fetchOrderBook(activeCrop.value)
    pollTimer = setInterval(() => {
      fetchOrderBook(activeCrop.value)
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function sell(item: string, amount: number, unitPrice: number) {
    error.value = null
    try {
      await apiSell(item, amount, unitPrice)
      await fetchOrderBook(activeCrop.value)
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
    } catch (e: any) {
      error.value = e.message ?? '发布失败'
      throw e
    }
  }

  async function buy(orderId: number) {
    error.value = null
    try {
      const result = await apiBuy(orderId)
      await fetchOrderBook(activeCrop.value)
      const userStore = useUserStore()
      await userStore.fetchUserInfo()
      return result
    } catch (e: any) {
      error.value = e.message ?? '购买失败'
      throw e
    }
  }

  function setActiveCrop(cropId: string) {
    activeCrop.value = cropId
    // MVP 4.3: 切换作物时立即拉取新作物的盘口
    fetchOrderBook(cropId)
  }

  onUnmounted(() => {
    stopPolling()
  })

  return {
    depth,
    floorPrice,
    myOrders,
    loading,
    error,
    activeCrop,
    activeDepth,
    activeFloorPrice,
    fetchOrderBook,
    startPolling,
    stopPolling,
    sell,
    buy,
    setActiveCrop,
  }
})
