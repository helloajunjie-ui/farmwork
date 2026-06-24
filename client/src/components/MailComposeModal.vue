<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMailboxStore } from '../stores/mailbox'
import { ALL_CROPS } from '../config/crops'
import { formatGold } from '../utils/format'

const props = defineProps<{
  show: boolean
  presetUsername?: string | null
}>()

const emit = defineEmits<{
  close: []
  sent: []
}>()

const mailboxStore = useMailboxStore()

const receiverUsername = ref(props.presetUsername || '')
const content = ref('')
const hasOffer = ref(false)
const offerItem = ref('wheat')
const offerAmount = ref(10)
const offerPrice = ref(100)
const sending = ref(false)
const error = ref('')
const success = ref('')

// 可选作物列表（排除种子）
const offerCrops = computed(() => {
  return Object.entries(ALL_CROPS)
    .filter(([id]) => id !== 'seed')
    .map(([id, cfg]) => ({ id, name: cfg.name, emoji: cfg.emoji }))
})

const selectedCrop = computed(() => ALL_CROPS[offerItem.value])

async function handleSend() {
  if (!receiverUsername.value.trim()) {
    error.value = '请输入收件人'
    return
  }
  if (!content.value.trim() && !hasOffer.value) {
    error.value = '请填写留言或附加契约'
    return
  }

  sending.value = true
  error.value = ''
  success.value = ''

  try {
    await mailboxStore.sendMail({
      receiver_username: receiverUsername.value.trim(),
      content: content.value,
      ...(hasOffer.value
        ? {
            offer_item: offerItem.value,
            offer_amount: Math.max(1, Math.floor(offerAmount.value)),
            offer_price: Math.max(1, Math.floor(offerPrice.value)),
          }
        : {}),
    })
    success.value = '📜 密函已投递！'
    // 重置表单
    content.value = ''
    hasOffer.value = false
    offerAmount.value = 10
    offerPrice.value = 100
    setTimeout(() => {
      emit('sent')
      emit('close')
    }, 1200)
  } catch (e: any) {
    error.value = e?.message || '发送失败'
  } finally {
    sending.value = false
  }
}

function resetForm() {
  receiverUsername.value = props.presetUsername || ''
  content.value = ''
  hasOffer.value = false
  offerItem.value = 'wheat'
  offerAmount.value = 10
  offerPrice.value = 100
  error.value = ''
  success.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4"
      @click.self="emit('close')"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div class="relative w-full max-w-sm rounded-2xl border border-amber-700/30 bg-amber-900/10 backdrop-blur-xl overflow-hidden transition-all duration-500 animate-fade-in">
        <!-- 顶部 -->
        <div class="p-5 border-b border-amber-700/20">
          <h3 class="text-base font-bold text-amber-100 font-serif">📜 撰写密函</h3>
          <p class="text-[10px] text-amber-500/60 mt-1 font-serif italic">— 火漆封印，暗流涌动 —</p>
        </div>

        <div class="p-5 space-y-4">
          <!-- 收件人 -->
          <div>
            <label class="text-xs text-amber-300/70 mb-1 block">收件人</label>
            <input
              v-model="receiverUsername"
              class="w-full bg-slate-800/50 border border-amber-700/20 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 transition-colors"
              placeholder="输入玩家名称"
              :disabled="!!presetUsername"
            />
          </div>

          <!-- 留言 -->
          <div>
            <label class="text-xs text-amber-300/70 mb-1 block">留言</label>
            <textarea
              v-model="content"
              class="w-full bg-slate-800/50 border border-amber-700/20 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/40 transition-colors resize-none"
              rows="3"
              placeholder="写下你想说的话..."
              maxlength="500"
            />
            <div class="text-[10px] text-slate-600 text-right mt-1">{{ content.length }}/500</div>
          </div>

          <!-- OTC 契约开关 -->
          <div class="flex items-center gap-2">
            <button
              class="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200"
              :class="hasOffer
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-700/30 text-slate-500 border-slate-700'"
              @click="hasOffer = !hasOffer"
            >
              {{ hasOffer ? '📦 附加收购契约' : '📦 附加契约' }}
            </button>
            <span v-if="!hasOffer" class="text-[10px] text-slate-600">可选：发起一笔黑市交易</span>
          </div>

          <!-- OTC 契约表单 -->
          <div v-if="hasOffer" class="bg-slate-800/50 border border-amber-700/20 rounded-xl p-4 space-y-3">
            <div class="text-[10px] text-amber-500/60 font-medium">🤝 场外收购契约</div>

            <!-- 选择物品 -->
            <div>
              <label class="text-[10px] text-slate-500 mb-1 block">收购物品</label>
              <select
                v-model="offerItem"
                class="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
              >
                <option v-for="crop in offerCrops" :key="crop.id" :value="crop.id">
                  {{ crop.emoji }} {{ crop.name }}
                </option>
              </select>
            </div>

            <!-- 数量 -->
            <div>
              <label class="text-[10px] text-slate-500 mb-1 block">数量</label>
              <input
                v-model.number="offerAmount"
                type="number"
                min="1"
                class="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
              />
            </div>

            <!-- 一口价 -->
            <div>
              <label class="text-[10px] text-slate-500 mb-1 block">一口价总价 (🪙)</label>
              <input
                v-model.number="offerPrice"
                type="number"
                min="1"
                class="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
              />
            </div>

            <div class="text-[10px] text-slate-600 text-center">
              单价 ≈ {{ offerAmount > 0 ? formatGold(Math.round(offerPrice / offerAmount)) : '0' }}/单位
            </div>
          </div>

          <!-- 反馈 -->
          <p v-if="error" class="text-xs text-red-400 text-center">{{ error }}</p>
          <p v-if="success" class="text-xs text-green-400 text-center">{{ success }}</p>
        </div>

        <!-- 操作按钮 -->
        <div class="flex border-t border-amber-700/20">
          <button
            class="flex-1 py-3 text-sm text-slate-500 hover:text-slate-400 transition-colors"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="flex-1 py-3 text-sm font-medium text-amber-300 hover:bg-amber-500/10 transition-all duration-200 border-l border-amber-700/20"
            :class="sending ? 'opacity-50' : ''"
            :disabled="sending"
            @click="handleSend"
          >
            {{ sending ? '⏳ 封印中...' : '🔏 火漆封印 · 发送' }}
          </button>
        </div>
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
