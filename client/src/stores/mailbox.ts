// ===== MVP 8.0: 信箱 Store =====
import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'
import type { MailboxMessage, SentMailboxMessage } from '../types'
import {
  fetchInbox as apiFetchInbox,
  fetchSentBox as apiFetchSentBox,
  fetchUnreadCount as apiFetchUnreadCount,
  sendMail as apiSendMail,
  markMailRead as apiMarkMailRead,
  acceptOffer as apiAcceptOffer,
  declineOffer as apiDeclineOffer,
} from '../api'
import type { SendMailRequest } from '../types'

export const useMailboxStore = defineStore('mailbox', () => {
  const inbox = ref<MailboxMessage[]>([])
  const sentBox = ref<SentMailboxMessage[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const sentLoading = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchInbox() {
    loading.value = true
    try {
      inbox.value = await apiFetchInbox()
    } finally {
      loading.value = false
    }
  }

  async function fetchSentBox() {
    sentLoading.value = true
    try {
      sentBox.value = await apiFetchSentBox()
    } finally {
      sentLoading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const data = await apiFetchUnreadCount()
      unreadCount.value = data.count
    } catch {
      // 静默失败
    }
  }

  async function sendMail(req: SendMailRequest) {
    await apiSendMail(req)
    // 刷新发件箱
    await fetchSentBox()
  }

  async function markRead(id: number) {
    await apiMarkMailRead(id)
    // 更新本地状态
    const mail = inbox.value.find((m) => m.id === id)
    if (mail && mail.status === 'unread') {
      mail.status = 'read'
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function acceptOffer(id: number) {
    await apiAcceptOffer(id)
    const mail = inbox.value.find((m) => m.id === id)
    if (mail) {
      mail.status = 'accepted'
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  async function declineOffer(id: number) {
    await apiDeclineOffer(id)
    const mail = inbox.value.find((m) => m.id === id)
    if (mail) {
      mail.status = 'declined'
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  }

  // 轮询未读计数
  function startPolling() {
    stopPolling()
    fetchUnreadCount()
    pollTimer = setInterval(() => {
      fetchUnreadCount()
    }, 15000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    inbox,
    sentBox,
    unreadCount,
    loading,
    sentLoading,
    fetchInbox,
    fetchSentBox,
    fetchUnreadCount,
    sendMail,
    markRead,
    acceptOffer,
    declineOffer,
    startPolling,
    stopPolling,
  }
})
