<script setup lang="ts">
import type { DepthItem } from '../types'

const props = defineProps<{
  depth: DepthItem[]
  floorPrice: number | null
  userId: number
  buyingIds: Set<number>
}>()

const emit = defineEmits<{
  buy: [orderId: number]
}>()

/** 买入某个价格层级的第一单 */
function handleBuyFirst(depthItem: DepthItem) {
  if (depthItem.order_ids.length === 0) return
  const firstId = depthItem.order_ids[0]
  if (props.buyingIds.has(firstId)) return
  emit('buy', firstId)
}

/** 计算该价格层级的总价（单价 × 总量） */
function totalCost(item: DepthItem): number {
  return item.unit_price * item.total_amount
}
</script>

<template>
  <div class="space-y-1">
    <!-- 表头 -->
    <div class="grid grid-cols-4 gap-2 px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-700/30">
      <span>单价</span>
      <span class="text-right">总量</span>
      <span class="text-right">总价</span>
      <span class="text-right">操作</span>
    </div>

    <!-- 盘口深度列表 -->
    <TransitionGroup name="depth" tag="div" class="space-y-0.5">
      <div
        v-for="item in depth"
        :key="item.unit_price"
        class="grid grid-cols-4 gap-2 items-center px-3 py-2 rounded-lg transition-all duration-200"
        :class="[
          item.unit_price === floorPrice
            ? 'border-l-4 border-red-500 bg-red-900/20'
            : 'bg-slate-800/30 hover:bg-slate-800/50 border-l-4 border-transparent',
        ]"
      >
        <!-- 单价 -->
        <div
          class="text-sm font-mono tabular-nums font-semibold"
          :class="item.unit_price === floorPrice ? 'text-red-400' : 'text-green-400'"
        >
          🪙 {{ item.unit_price }}
          <span v-if="item.unit_price === floorPrice" class="text-[10px] text-red-500 ml-1 font-normal">地板</span>
        </div>

        <!-- 总量 -->
        <div class="text-xs text-slate-300 text-right font-mono tabular-nums">
          ×{{ item.total_amount }}
        </div>

        <!-- 总价 -->
        <div class="text-xs text-slate-400 text-right font-mono tabular-nums">
          🪙 {{ totalCost(item) }}
        </div>

        <!-- 操作：买入该层级第一单 -->
        <div class="text-right">
          <button
            v-if="item.order_ids.length > 0"
            class="text-xs font-medium px-2.5 py-1 rounded-lg transition-all duration-200"
            :class="buyingIds.has(item.order_ids[0])
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 active:scale-95'"
            :disabled="buyingIds.has(item.order_ids[0])"
            @click="handleBuyFirst(item)"
          >
            {{ buyingIds.has(item.order_ids[0]) ? '⏳' : '吃单' }}
          </button>
        </div>
      </div>
    </TransitionGroup>

    <!-- 空状态 -->
    <div v-if="depth.length === 0" class="text-center py-12 text-slate-500">
      <div class="text-3xl mb-2">📭</div>
      <p class="text-sm">盘口空空如也</p>
      <p class="text-xs text-slate-600 mt-1">快来挂第一单吧</p>
    </div>
  </div>
</template>

<style scoped>
/* TransitionGroup 动画 */
.depth-enter-active,
.depth-leave-active {
  transition: all 0.3s ease;
}
.depth-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.depth-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.depth-move {
  transition: transform 0.3s ease;
}
</style>
