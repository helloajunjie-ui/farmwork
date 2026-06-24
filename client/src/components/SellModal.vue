<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useMarketStore } from '../stores/market'
import { useUserStore } from '../stores/user'
import { ALL_CROPS } from '../config/crops'

const props = defineProps<{
  show: boolean
  // MVP 4.3: 锁定当前交易对，不再允许切换
  activeCrop: string
}>()
const emit = defineEmits<{ close: [] }>()

const marketStore = useMarketStore()
const userStore = useUserStore()

const amount = ref(1)
const unitPrice = ref(1)
const submitting = ref(false)

// MVP 4.3: 锁定为当前活跃作物
const selectedItem = ref(props.activeCrop)

// 当前作物的配置
const cropConfig = computed(() => ALL_CROPS[selectedItem.value])

// 预计收入
const expectedRevenue = computed(() => amount.value * unitPrice.value)

// 当前选中物品的库存
const currentInventory = computed(() => {
  return userStore.items[selectedItem.value] ?? 0
})

// 种植成本锚点（种子价 / 产量 = 每颗成本）
const costAnchor = computed(() => {
  if (!cropConfig.value) return 0
  return cropConfig.value.baseSeedPrice / cropConfig.value.yield
})

watch(
  () => props.show,
  (v) => {
    if (v) {
      // MVP 4.3: 锁定为当前活跃作物
      selectedItem.value = props.activeCrop
      amount.value = 1
      unitPrice.value = 1
    }
  }
)

// MVP 4.3: 当 activeCrop 变化时同步更新
watch(
  () => props.activeCrop,
  (crop) => {
    selectedItem.value = crop
  }
)

async function handleSubmit() {
  if (submitting.value) return
  if (amount.value <= 0 || unitPrice.value <= 0) return
  if (amount.value > currentInventory.value) return

  submitting.value = true
  try {
    await marketStore.sell(selectedItem.value, amount.value, unitPrice.value)
    emit('close')
  } catch {
    // error 已在 store 中记录
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- 背景 -->
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      />

      <!-- 弹窗 -->
      <div
        class="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl transition-all duration-300"
      >
        <!-- MVP 4.3: 显示锁定作物 -->
        <h3 class="text-base font-bold text-slate-100 mb-1">
          📦 发布挂单
        </h3>
        <div class="text-xs text-slate-400 mb-4 flex items-center gap-1">
          <span>正在挂单：</span>
          <span class="text-slate-200 font-medium">
            {{ cropConfig?.emoji }} {{ cropConfig?.name ?? activeCrop }}
          </span>
        </div>

        <!-- 库存显示 -->
        <div class="mb-4 px-3 py-2 rounded-lg bg-slate-700/30 text-xs text-slate-400 flex items-center justify-between">
          <span>库存</span>
          <span class="font-mono tabular-nums text-slate-300">×{{ currentInventory }}</span>
        </div>

        <!-- 数量 -->
        <div class="mb-4">
          <label class="text-xs text-slate-400 mb-1.5 block">数量</label>
          <input
            v-model.number="amount"
            type="number"
            min="1"
            :max="currentInventory"
            class="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
            placeholder="输入数量"
          />
        </div>

        <!-- 单价 -->
        <div class="mb-2">
          <label class="text-xs text-slate-400 mb-1.5 block">单价（金币/颗）</label>
          <input
            v-model.number="unitPrice"
            type="number"
            min="1"
            class="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
            placeholder="输入单价"
          />
        </div>

        <!-- 预计收入 + 市场参考 -->
        <div class="mb-6 space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">预计收入</span>
            <span class="text-yellow-400 font-semibold font-mono tabular-nums">
              🪙 {{ expectedRevenue }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">当前地板价</span>
            <span class="text-slate-400 font-mono tabular-nums">
              {{ marketStore.activeFloorPrice !== null ? `🪙 ${marketStore.activeFloorPrice}/颗` : '暂无' }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">种植成本</span>
            <span class="text-slate-400 font-mono tabular-nums">
              🪙 {{ costAnchor.toFixed(2) }}/颗
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3">
          <button
            class="flex-1 text-sm px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all duration-200"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            class="flex-1 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200"
            :class="submitting || amount > currentInventory
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 active:scale-95'"
            :disabled="submitting || amount > currentInventory"
            @click="handleSubmit"
          >
            {{ submitting ? '⏳ 发布中...' : '✅ 确认发布' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
