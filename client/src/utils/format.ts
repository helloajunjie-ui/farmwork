// ===== MVP 6.0: 全局单位格式化系统 =====
// 所有价格、数量显示必须经过此工具函数，杜绝光秃秃的数字

/**
 * 格式化金币：带千分位 + 🪙 符号
 * 例: 12500 → "12,500 🪙"
 * 例: 12500000 → "12.5M 🪙"
 */
export function formatGold(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M 🪙`
  }
  if (amount >= 10_000) {
    return `${(amount / 1_000).toFixed(1)}k 🪙`
  }
  return `${amount.toLocaleString('zh-CN')} 🪙`
}

/**
 * 紧凑金币格式（用于表格/小空间）
 * 例: 12500 → "12.5k"
 */
export function formatGoldCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 10_000) {
    return `${(amount / 1_000).toFixed(1)}k`
  }
  return amount.toLocaleString('zh-CN')
}

/**
 * 格式化物资数量：带千分位 + 吨
 * 例: 450 → "450 吨"
 * 例: 1200 → "1,200 吨"
 */
export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('zh-CN')} 吨`
}

/**
 * 紧凑物资格式（用于小空间）
 * 例: 450 → "450t"
 * 例: 1200 → "1.2kt"
 */
export function formatAmountCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}Mt`
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}kt`
  }
  return `${amount}t`
}

/**
 * 格式化百分比
 * 例: 0.45 → "+45%"
 * 例: -0.2 → "-20%"
 */
export function formatPercent(value: number): string {
  const pct = Math.round(value * 100)
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

/**
 * 格式化时间（分钟 → 可读字符串）
 * 例: 10 → "10 分钟"
 * 例: 90 → "1 小时 30 分钟"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
}

/**
 * 格式化剩余秒数
 * 例: 3661 → "1h 1m 1s"
 */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

/**
 * 格式化单价（用于盘口）
 * 例: 5 → "🪙 5.00"
 */
export function formatUnitPrice(price: number): string {
  return `🪙 ${price.toFixed(2)}`
}
