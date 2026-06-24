<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMailboxStore } from '../stores/mailbox'
import MailDetailModal from './MailDetailModal.vue'
import type { MailboxMessage } from '../types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const mailboxStore = useMailboxStore()
const activeTab = ref<'inbox' | 'sent'>('inbox')
const selectedMail = ref<MailboxMessage | null>(null)
const showDetail = ref(false)

onMounted(async () => {
  if (props.show) {
    await Promise.all([
      mailboxStore.fetchInbox(),
      mailboxStore.fetchSentBox(),
    ])
  }
})

const displayMails = computed(() => {
  if (activeTab.value === 'inbox') return mailboxStore.inbox
  return mailboxStore.sentBox as any
})

function openMail(mail: MailboxMessage) {
  selectedMail.value = mail
  showDetail.value = true
}

function onDetailUpdated() {
  // 刷新列表
  mailboxStore.fetchInbox()
  mailboxStore.fetchSentBox()
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getStatusBadge(status: string): { text: string; color: string } {
  switch (status) {
    case 'unread': return { text: '未读', color: 'bg-amber-500/20 text-amber-400' }
    case 'read': return { text: '已读', color: 'bg-slate-500/20 text-slate-400' }
    case 'accepted': return { text: '已成交', color: 'bg-green-500/20 text-green-400' }
    case 'declined': return { text: '已拒绝', color: 'bg-red-500/20 text-red-400' }
    default: return { text: status, color: 'bg-slate-500/20 text-slate-400' }
  }
}

function getMailSummary(mail: any): string {
  if (mail.offer_item) {
    const hasContent = mail.content?.length > 0
    return hasContent ? `📜 ${mail.content.slice(0, 30)}${mail.content.length > 30 ? '...' : ''}` : '📦 附带收购契约'
  }
  return mail.content?.slice(0, 40) || '（无内容）'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div class="relative w-full max-w-sm rounded-2xl border border-slate-600/50 bg-slate-800/95 backdrop-blur-xl overflow-hidden transition-all duration-500 animate-fade-in max-h-[80vh] flex flex-col">
        <!-- 顶部 -->
        <div class="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-100">📬 信箱</h3>
          <button class="text-xs text-slate-500 hover:text-slate-400 transition-colors" @click="emit('close')">关闭</button>
        </div>

        <!-- Tab 切换 -->
        <div class="flex border-b border-slate-700/30">
          <button
            class="flex-1 py-2.5 text-xs font-medium transition-all duration-200"
            :class="activeTab === 'inbox'
              ? 'text-amber-400 border-b-2 border-amber-400/50'
              : 'text-slate-500 hover:text-slate-300'"
            @click="activeTab = 'inbox'"
          >
            收件箱
            <span v-if="mailboxStore.unreadCount > 0" class="ml-1 text-[10px] text-red-400">({{ mailboxStore.unreadCount }})</span>
          </button>
          <button
            class="flex-1 py-2.5 text-xs font-medium transition-all duration-200"
            :class="activeTab === 'sent'
              ? 'text-amber-400 border-b-2 border-amber-400/50'
              : 'text-slate-500 hover:text-slate-300'"
            @click="activeTab = 'sent'"
          >
            发件箱
          </button>
        </div>

        <!-- 列表 -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="displayMails.length === 0" class="text-center py-12 text-slate-500">
            <div class="text-3xl mb-2">📭</div>
            <p class="text-xs">空空如也</p>
          </div>

          <div v-else class="p-2 space-y-1">
            <button
              v-for="mail in displayMails"
              :key="mail.id"
              class="w-full text-left px-3 py-3 rounded-xl transition-all duration-200 hover:bg-slate-700/20"
              :class="mail.status === 'unread' ? 'bg-slate-700/10 border-l-2 border-amber-400/30' : ''"
              @click="openMail(mail)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm">{{ activeTab === 'inbox' ? '📩' : '📤' }}</span>
                  <span class="text-xs font-medium text-slate-300 truncate">
                    {{ activeTab === 'inbox' ? mail.sender_name : (mail as any).receiver_name }}
                  </span>
                </div>
                <span class="text-[10px] text-slate-600 shrink-0">{{ formatTime(mail.created_at) }}</span>
              </div>
              <div class="mt-1 text-[10px] text-slate-500 truncate pl-7">
                {{ getMailSummary(mail) }}
              </div>
              <div class="mt-1 pl-7">
                <span class="text-[10px] px-1.5 py-0.5 rounded" :class="getStatusBadge(mail.status).color">
                  {{ getStatusBadge(mail.status).text }}
                </span>
                <span v-if="mail.offer_item" class="text-[10px] text-amber-500/60 ml-1">📜 含契约</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- 信件详情弹窗 -->
      <MailDetailModal
        :show="showDetail"
        :mail="selectedMail"
        @close="showDetail = false"
        @updated="onDetailUpdated"
      />
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
