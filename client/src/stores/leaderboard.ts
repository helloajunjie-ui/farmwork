import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LeaderboardData, LeaderboardEntry } from '../types'
import { fetchLeaderboard as apiFetchLeaderboard } from '../api'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const farmers = ref<LeaderboardEntry[]>([])
  const capitalists = ref<LeaderboardEntry[]>([])
  const loading = ref(false)
  const updatedAt = ref(0)

  async function fetchLeaderboard() {
    loading.value = true
    try {
      const data: LeaderboardData = await apiFetchLeaderboard()
      farmers.value = data.farmers
      capitalists.value = data.capitalists
      updatedAt.value = data.updated_at
    } catch {
      // error handled by interceptor
    } finally {
      loading.value = false
    }
  }

  return {
    farmers,
    capitalists,
    loading,
    updatedAt,
    fetchLeaderboard,
  }
})
