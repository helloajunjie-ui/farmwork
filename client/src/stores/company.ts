// ===== 企业收购价 Store =====
// 3 秒轮询企业收购价，SWR 模式（静默更新，无 loading 态）

import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'
import type { CompanyInfo, SellToCompanyResponse } from '../types'
import { fetchCompanies, sellToCompany } from '../api'
import { mockFetchCompanies, mockSellToCompany } from '../api/mock'

// 自动检测是否使用 Mock（与 market store 一致）
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const apiFetch = useMock ? mockFetchCompanies : fetchCompanies
const apiSell = useMock ? mockSellToCompany : sellToCompany

export const useCompanyStore = defineStore('company', () => {
  const companies = ref<CompanyInfo[]>([])
  const loading = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchCompanyPrices() {
    try {
      const data = await apiFetch()
      companies.value = data
    } catch (e) {
      console.error('[CompanyStore] 获取企业收购价失败:', e)
    }
  }

  function startPolling() {
    fetchCompanyPrices()
    pollTimer = setInterval(fetchCompanyPrices, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function sell(item: string, amount: number): Promise<SellToCompanyResponse> {
    const result = await apiSell(item, amount)
    // 成功后刷新企业价格
    await fetchCompanyPrices()
    return result
  }

  // 自动清理
  onUnmounted(() => {
    stopPolling()
  })

  return {
    companies,
    loading,
    fetchCompanyPrices,
    startPolling,
    stopPolling,
    sell,
  }
})
