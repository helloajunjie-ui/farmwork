<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMailboxStore } from '../stores/mailbox'
import { formatGold, formatSeconds } from '../utils/format'
import { ALL_CROPS } from '../config/crops'
import type { MailboxMessage } from '../types'

const props = defineProps<{
  show: boolean
  mail: MailboxMessage | null
  isSent?: boolean  // 是否为发件箱视角
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const mailboxStore = useMailboxStore()
const processing = ref(false)
const error = ref('')
const successMsg = ref('')

const isReceiver = computed(() => {
  // 收件箱的信件，当前用户是 receiver
  return props.mail?.status === 'unread' || props.mail?.status === 'read'
})

const hasOffer = computed(() => {
  return props.mail?.offer_item && props.mail?.offer_amount && props.mail?.offer_price
})

const offerCrop = computed(() => {
  if (!props.mail?.offer_item) return null
  return ALL_CROPS[props.mail.offer_item] || null
})

const canAct = computed(() => {
  return props.mail && (props.mail.status === 'unread' || props.mail.status === 'read')
})

const statusLabel = computed(() => {
  switch (props.mail?.status) {
    case 'unread': return { text: '📩 未读', color: 'text-amber-400' }
    case 'read': return { text: '👁️ 已读', color: 'text-slate-400' }
    case 'accepted': return { text: '🤝 已成交', color: 'text-green-400' }
    case 'declined': return { text: '❌ 已拒绝', color: 'text-red-400' }
    default: return { text: props.mail?.status || '', color: 'text-slate-400' }
  }
})

async function handleMarkRead() {
  if (!props.mail || !canAct.value) return
  await mailboxStore.markRead(props.mail.id)
  emit('updated')
}

async function handleAccept() {
  if (!props.mail || processing.value) return
  processing.value = true
  error.value = ''
  successMsg.value = ''
  try {
    await mailboxStore.acceptOffer(props.mail.id)
    successMsg.value = '🎉 契约成交！钱货两清'
    emit('updated')
  } catch (e: any) {
    error.value = e?.message || '交割失败'
  } finally {
    processing.value = false
  }
}

async function handleDecline() {
  if (!props.mail || processing.value) return
  processing.value = true
  error.value = ''
  successMsg.value = ''
  try {
    await mailboxStore.declineOffer(props.mail.id)
    successMsg.value = '已拒绝该契约'
    emit('updated')
  } catch (e: any) {
    error.value = e?.message || '操作失败'
  } finally {
    processing.value = false
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show && mail"
      class="fixed inset-0 z-[130] flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <!-- 火漆信封卡片 -->
      <div class="relative w-full max-w-sm rounded-2xl border border-amber-700/30 bg-amber-900/10 backdrop-blur-xl overflow-hidden transition-all duration-500 animate-fade-in">
        <!-- 顶部火漆印章 -->
        <div class="pt-6 pb-2 text-center">
          <div class="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-red-500/40 to-red-700/40 border-2 border-red-500/30 flex items-center justify-center text-xl shadow-lg shadow-red-500/10">
            🔴
          </div>
          <div class="text-[10px] text-amber-500/40 mt-1 font-serif">火漆封印</div>
        </div>

        <!-- 发件人/收件人信息 -->
        <div class="px-6 py-3 text-center border-b border-amber-700/10">
          <div class="text-xs text-amber-300/50 font-serif">{{ isSent ? '致' : '来自' }}</div>
          <div class="text-base font-bold text-amber-100 font-serif mt-0.5">
            {{ isSent ? (mail as any).receiver_name : mail.sender_name }}
          </div>
          <div class="text-[10px] text-slate-500 mt-1 font-mono">{{ formatTime(mail.created_at) }}</div>
          <div class="mt-1">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="statusLabel.color + ' bg-slate-700/30'">
              {{ statusLabel.text }}
            </span>
          </div>
        </div>

        <!-- 留言内容 -->
        <div class="px-6 py-4">
          <p class="text-sm text-slate-300 leading-relaxed font-serif whitespace-pre-wrap">
            {{ mail.content || '（无留言）' }}
          </p>
        </div>

        <!-- OTC 契约卡片 -->
        <div v-if="hasOffer" class="mx-6 mb-4 rounded-xl border border-amber-600/20 bg-amber-800/10 p-4">
          <div class="text-[10px] text-amber-500/60 font-medium mb-2">📜 附带契约</div>
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ offerCrop?.emoji || '📦' }}</span>
            <div class="flex-1">
              <div class="text-sm font-medium text-slate-200">{{ offerCrop?.name || mail.offer_item }}</div>
              <div class="text-xs text-slate-500">数量: {{ mail.offer_amount?.toLocaleString() }} 吨</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-amber-400 font-mono">{{ formatGold(mail.offer_price || 0) }}</div>
              <div class="text-[10px] text-slate-600">一口价</div>
            </div>
          </div>
        </div>

        <!-- 操作按钮（仅未处理时可操作） -->
        <div v-if="canAct && hasOffer" class="flex border-t border-amber-700/20">
          <button
            class="flex-1 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-all duration-200 border-r border-amber-700/20"
            :disabled="processing"
            @click="handleDecline"
          >
            {{ processing ? '...' : '❌ 拒绝' }}
          </button>
          <button
            class="flex-1 py-3 text-sm font-medium text-green-400 hover:bg-green-500/10 transition-all duration-200"
            :disabled="processing"
            @click="handleAccept"
          >
            {{ processing ? '⏳ 交割中...' : '🤝 盖章成交' }}
          </button>
        </div>

        <!-- 纯文本信件的已读按钮 -->
        <div v-else-if="canAct && !hasOffer" class="border-t border-amber-700/20">
          <button
            class="w-full py-3 text-sm text-amber-300 hover:bg-amber-500/10 transition-all duration-200"
            @click="handleMarkRead"
          >
            👁️ 标记为已读
          </button>
        </div>

        <!-- 反馈 -->
        <div v-if="error" class="px-6 py-2 text-xs text-red-400 text-center bg-red-500/5">{{ error }}</div>
        <div v-if="successMsg" class="px-6 py-2 text-xs text-green-400 text-center bg-green-500/5">{{ successMsg }}</div>

        <!-- 关闭 -->
        <button
          class="w-full py-2.5 text-xs text-slate-500 hover:text-slate-400 transition-colors bg-black/10"
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
