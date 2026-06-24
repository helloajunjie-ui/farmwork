/**
 * Mock 拦截器 — 纯前端内存模拟后端逻辑
 *
 * 设计原则：
 * - 所有数据在内存中维护，模拟数据库状态
 * - 使用 setTimeout 模拟网络延迟 (200~400ms)
 * - 生长周期压缩：1 分钟 → 1 秒
 * - 完整实现后端校验逻辑（库存检查、成熟判定、防重复购买）
 * - 作物/企业配置从 gameData.ts 导入，杜绝重复定义
 */

import type {
  UserInfo,
  Plot,
  PlotStatus,
  HarvestResponse,
  BuyResponse,
  UnlockResponse,
  CowStatus,
  BuySeedResponse,
  DepthItem,
  MyOrder,
  OrderBookData,
  CompanyInfo,
  SellToCompanyResponse,
} from '../types'

import {
  ALL_CROPS,
  CROP_IDS,
  COMPANIES,
  getCropConfig,
} from '../config/gameData'

// ===== 模拟数据库 =====
let nextOrderId = 1

// 🔴 V1.0.1: 初始化用户库存：seed_wheat + 所有作物
const initialItems: Record<string, number> = { seed_wheat: 10 }
for (const id of CROP_IDS) {
  initialItems[id] = 0
}

const user: UserInfo = {
  user_id: 1,
  nickname: '青羽',
  gold: 100,
  items: { ...initialItems },
  avatar_url: null,
  upkeep: {
    rate: 0,
    minutes_remaining: 999,
    unlocked_plots: 6,
    is_bankrupt: false,
  },
}

// 12 块地：前 6 块空闲，后 6 块锁定
const UNLOCK_PRICES = [null, 100, 500, 2000, 8000, 32000, 128000] as const

const plots: Plot[] = Array.from({ length: 12 }, (_, i) => ({
  plot_id: i + 1,
  status: (i < 6 ? 'idle' : 'locked') as PlotStatus,
  planted_at: null,
  crop: null,
  remaining_seconds: 0,
  unlock_price: i < 6 ? null : UNLOCK_PRICES[i - 5],
}))

// 订单存储
interface MockOrder {
  id: number
  seller_id: number
  seller_name: string
  item: string
  amount: number
  total_price: number
  created_at: number
  status: 'active' | 'sold'
}

const orders: MockOrder[] = [
  // 谷物类
  { id: nextOrderId++, seller_id: 2, seller_name: '农民小王', item: 'corn', amount: 5, total_price: 8, created_at: Math.floor(Date.now() / 1000) - 120, status: 'active' },
  { id: nextOrderId++, seller_id: 3, seller_name: '种田张', item: 'corn', amount: 10, total_price: 12, created_at: Math.floor(Date.now() / 1000) - 60, status: 'active' },
  { id: nextOrderId++, seller_id: 4, seller_name: '丰收李', item: 'corn', amount: 3, total_price: 6, created_at: Math.floor(Date.now() / 1000) - 30, status: 'active' },
  { id: nextOrderId++, seller_id: 2, seller_name: '农民小王', item: 'rice', amount: 8, total_price: 20, created_at: Math.floor(Date.now() / 1000) - 90, status: 'active' },
  // 蔬菜类
  { id: nextOrderId++, seller_id: 3, seller_name: '种田张', item: 'cabbage', amount: 12, total_price: 10, created_at: Math.floor(Date.now() / 1000) - 45, status: 'active' },
  { id: nextOrderId++, seller_id: 4, seller_name: '丰收李', item: 'tomato', amount: 8, total_price: 16, created_at: Math.floor(Date.now() / 1000) - 20, status: 'active' },
  // 水果类
  { id: nextOrderId++, seller_id: 3, seller_name: '种田张', item: 'apple', amount: 5, total_price: 20, created_at: Math.floor(Date.now() / 1000) - 70, status: 'active' },
  // 经济作物
  { id: nextOrderId++, seller_id: 2, seller_name: '农民小王', item: 'cotton', amount: 3, total_price: 18, created_at: Math.floor(Date.now() / 1000) - 110, status: 'active' },
]

// 打工牛状态
let cowActive = false
let cowLastSync: number | null = null

// ===== 生长周期常量（Mock 压缩：1 分钟 → 1 秒） =====
function getGrowDuration(cropId: string): number {
  const cfg = ALL_CROPS[cropId]
  return cfg ? cfg.totalTimeMin : 28 // 默认 28 秒
}

// ===== 工具函数 =====
function delay(ms = 250): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 150))
}

function now(): number {
  return Math.floor(Date.now() / 1000)
}

/** 从订单列表计算盘口深度 */
function buildDepth(): DepthItem[] {
  const active = orders.filter((o) => o.status === 'active')
  const groups = new Map<number, { total: number; ids: number[] }>()
  for (const o of active) {
    const up = Math.floor(o.total_price / o.amount)
    const g = groups.get(up) || { total: 0, ids: [] }
    g.total += o.amount
    g.ids.push(o.id)
    groups.set(up, g)
  }
  return Array.from(groups.entries())
    .map(([unit_price, g]) => ({ unit_price, total_amount: g.total, order_ids: g.ids }))
    .sort((a, b) => a.unit_price - b.unit_price)
}

/** 获取我的挂单 */
function getMyOrders(): MyOrder[] {
  return orders
    .filter((o) => o.seller_id === user.user_id && o.status === 'active')
    .map((o) => ({
      id: o.id,
      unit_price: Math.floor(o.total_price / o.amount),
      amount: o.amount,
      total_price: o.total_price,
      created_at: o.created_at,
    }))
}

// ===== API Mock 实现 =====

export async function mockFetchUserInfo(): Promise<UserInfo> {
  await delay()
  return { ...user, items: { ...user.items } }
}

export async function mockFetchPlots(): Promise<Plot[]> {
  await delay(200)
  const t = now()
  return plots.map((p) => {
    if (p.status === 'locked') {
      return { ...p, planted_at: null, crop: null, remaining_seconds: 0 }
    }
    if (p.planted_at === null) {
      return { ...p, status: 'idle', remaining_seconds: 0 }
    }
    const elapsed = t - p.planted_at
    const duration = getGrowDuration(p.crop || 'corn')
    if (elapsed >= duration) {
      return { ...p, status: 'ready', remaining_seconds: 0 }
    }
    return { ...p, status: 'growing', remaining_seconds: duration - elapsed }
  })
}

export async function mockPlant(plotId: number, crop: string): Promise<void> {
  await delay(300)

  const plot = plots.find((p) => p.plot_id === plotId)
  if (!plot) throw { code: 9001, message: '土地不存在' }
  if (plot.status !== 'idle') throw { code: 1001, message: '土地已被占用' }
  if (!ALL_CROPS[crop]) throw { code: 1003, message: '不支持的作物' }
  // 🔴 V1.0.1: 按作物区分种子
  const seedItem = `seed_${crop}`
  if ((user.items[seedItem] ?? 0) < 1) throw { code: 1002, message: `${ALL_CROPS[crop].name}种子不足` }

  user.items[seedItem] -= 1
  plot.planted_at = now()
  plot.crop = crop
  plot.status = 'growing'
}

export async function mockHarvest(plotId: number): Promise<HarvestResponse> {
  await delay(300)

  const plot = plots.find((p) => p.plot_id === plotId)
  if (!plot) throw { code: 9001, message: '土地不存在' }
  if (plot.planted_at === null) throw { code: 1101, message: '该土地未播种' }

  const elapsed = now() - plot.planted_at
  const duration = getGrowDuration(plot.crop || 'corn')
  if (elapsed < duration) throw { code: 1102, message: '作物尚未成熟' }

  const cropConfig = ALL_CROPS[plot.crop || 'corn']
  const harvested = cropConfig ? cropConfig.yield : 3
  const cropId = plot.crop || 'corn'

  user.items[cropId] = (user.items[cropId] ?? 0) + harvested
  plot.planted_at = null
  plot.crop = null
  plot.status = 'idle'

  return {
    plot_id: plotId,
    status: 'idle',
    harvested,
    items: { ...user.items },
  }
}

export async function mockUnlockPlot(plotId: number): Promise<UnlockResponse> {
  await delay(400)

  const plot = plots.find((p) => p.plot_id === plotId)
  if (!plot) throw { code: 9001, message: '土地不存在' }
  if (plot.status !== 'locked') throw { code: 1201, message: '该土地无需解锁' }

  const price = plot.unlock_price
  if (price === null) throw { code: 1202, message: '该土地无法解锁' }
  if (user.gold < price) throw { code: 1203, message: '金币不足' }

  user.gold -= price
  plot.status = 'idle'
  plot.unlock_price = null

  return {
    plot_id: plotId,
    status: 'idle',
    cost: price,
  }
}

export async function mockBuyCow(): Promise<void> {
  await delay(300)

  if (cowActive) throw { code: 1301, message: '已经拥有一头打工牛了' }
  if (user.gold < 5000) throw { code: 1302, message: '金币不足，需要 5000 金币' }

  user.gold -= 5000
  cowActive = true
  cowLastSync = now()
}

export async function mockFetchCowStatus(): Promise<CowStatus> {
  await delay(200)
  return {
    has_cow: cowActive,
    active: cowActive,
    last_sync_at: cowLastSync,
  }
}

export async function mockBuySeed(amount: number, crop?: string): Promise<BuySeedResponse> {
  await delay(200)

  if (amount <= 0 || !Number.isInteger(amount)) {
    throw { code: 9001, message: '参数无效' }
  }

  const cropId = crop || 'corn'
  const cropConfig = ALL_CROPS[cropId]
  if (!cropConfig) throw { code: 9001, message: '不支持的作物' }

  const basePrice = cropConfig.baseSeedPrice
  const companyId = cropConfig.companyId
  const companyPrice = companyPrices[companyId]?.buyPrice ?? basePrice * 2
  const companyBase = companyPrices[companyId]?.basePrice ?? basePrice * 2

  // 种子价 = 基础种子价 + (当前收购价 - 基础收购价) * 0.8
  const seedPrice = Math.max(basePrice, Math.round(basePrice + (companyPrice - companyBase) * 0.8))
  const totalCost = amount * seedPrice

  if (user.gold < totalCost) {
    throw { code: 5001, message: `金币不足，需要 ${totalCost} 金币` }
  }

  user.gold -= totalCost
  // 🔴 V1.0.1: 按作物区分种子
  const seedItem = `seed_${cropId}`
  user.items[seedItem] = (user.items[seedItem] ?? 0) + amount

  return {
    amount,
    cost: totalCost,
    price_per_unit: seedPrice,
    crop: cropId,
  }
}

/** 获取某个作物的当前种子售价（Mock） */
export async function mockFetchSeedPrice(cropId: string): Promise<number> {
  await delay(100)
  const cropConfig = ALL_CROPS[cropId]
  if (!cropConfig) return 2
  const basePrice = cropConfig.baseSeedPrice
  const companyId = cropConfig.companyId
  const companyPrice = companyPrices[companyId]?.buyPrice ?? basePrice * 2
  const companyBase = companyPrices[companyId]?.basePrice ?? basePrice * 2
  return Math.max(basePrice, Math.round(basePrice + (companyPrice - companyBase) * 0.8))
}

// ===== 市场 API (MVP 2.0 聚合格式) =====

export async function mockFetchOrderBook(_itemId?: string): Promise<OrderBookData> {
  await delay(200)
  const depth = buildDepth()
  const floor_price = depth.length > 0 ? depth[0].unit_price : null
  const my_orders = getMyOrders()
  return { depth, floor_price, my_orders }
}

export async function mockSell(
  item: string,
  amount: number,
  unitPrice: number
): Promise<{ order_id: number }> {
  await delay(300)

  if (amount <= 0 || unitPrice <= 0) throw { code: 2002, message: '参数无效' }
  if ((user.items[item] ?? 0) < amount) throw { code: 2001, message: '库存不足' }

  const totalPrice = amount * unitPrice

  // 扣库存（冻结）
  user.items[item] -= amount

  const order: MockOrder = {
    id: nextOrderId++,
    seller_id: user.user_id,
    seller_name: user.nickname,
    item,
    amount,
    total_price: totalPrice,
    created_at: now(),
    status: 'active',
  }
  orders.push(order)

  return { order_id: order.id }
}

export async function mockBuy(orderId: number): Promise<BuyResponse> {
  await delay(300)

  const order = orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'active') {
    throw { code: 2101, message: '订单不存在或已售出' }
  }
  if (order.seller_id === user.user_id) {
    throw { code: 2102, message: '不能购买自己的订单' }
  }
  if (user.gold < order.total_price) {
    throw { code: 2103, message: '金币不足' }
  }

  order.status = 'sold'
  user.gold -= order.total_price
  user.items[order.item] = (user.items[order.item] ?? 0) + order.amount

  return {
    order_id: order.id,
    item: order.item,
    amount: order.amount,
    cost: order.total_price,
    gold_remaining: user.gold,
  }
}

// ===== 企业收购价模拟 =====
// 模拟价格波动：基准价 ±20% 随机游走
interface MockCompanyPrice {
  buyPrice: number
  basePrice: number
  event: { title: string; multiplier: number } | null
}

const companyPrices: Record<string, MockCompanyPrice> = {}

// 初始化 10 家企业价格
for (const [id, cfg] of Object.entries(COMPANIES)) {
  const cropCfg = ALL_CROPS[cfg.buyItem]
  const basePrice = cropCfg ? cropCfg.baseSellPrice : 3
  companyPrices[id] = { buyPrice: basePrice, basePrice, event: null }
}

// 新闻事件列表（16 个事件覆盖所有分类）
const newsEvents: { title: string; cropId: string; multiplier: number }[] = [
  // 谷物类
  { title: '🌾 小麦锈病爆发！面粉厂紧急采购！', cropId: 'wheat', multiplier: 1.5 },
  { title: '🌽 玉米丰收节！饲料厂大量囤货！', cropId: 'corn', multiplier: 1.5 },
  { title: '🍚 水稻产区干旱！米价飙升！', cropId: 'rice', multiplier: 1.6 },
  { title: '🌾 饲料级高粱需求暴增！', cropId: 'sorghum', multiplier: 1.4 },
  // 蔬菜类
  { title: '🥬 泡菜节！大润发紧急采购白菜！', cropId: 'cabbage', multiplier: 1.5 },
  { title: '🍅 番茄酱厂原料告急！', cropId: 'tomato', multiplier: 1.4 },
  { title: '🧄 大蒜价格创历史新高！', cropId: 'garlic', multiplier: 1.6 },
  // 水果类
  { title: '🧃 果汁出口订单暴增！苹果需求旺盛！', cropId: 'apple', multiplier: 1.5 },
  { title: '🍇 葡萄酒年份评级优异！葡萄抢购！', cropId: 'grape', multiplier: 1.5 },
  { title: '🍒 高端水果市场火爆！樱桃供不应求！', cropId: 'cherry', multiplier: 1.7 },
  // 经济作物
  { title: '☁️ 纺织厂订单排到明年！棉花暴涨！', cropId: 'cotton', multiplier: 1.5 },
  { title: '🍬 国际糖价飙升！甜菜收购价大涨！', cropId: 'sugar_beet', multiplier: 1.5 },
  { title: '☕ 南美咖啡减产！国产咖啡豆替代需求！', cropId: 'coffee', multiplier: 1.6 },
  // 珍稀草药
  { title: '🌱 保健品市场需求井喷！人参价格翻倍！', cropId: 'ginseng', multiplier: 1.8 },
  { title: '🌸 顶级餐厅抢购藏红花！价格暴涨！', cropId: 'saffron', multiplier: 1.8 },
  { title: '🐛 冬虫夏草被列为国礼！价格冲天！', cropId: 'cordyceps', multiplier: 2.0 },
]

let activeNewsEvent: { title: string; cropId: string; multiplier: number } | null = null
let newsTimer: ReturnType<typeof setTimeout> | null = null

// 每 30 秒模拟一次价格波动
setInterval(() => {
  for (const c of Object.values(companyPrices)) {
    const change = 1 + (Math.random() - 0.5) * 0.1 // 0.95 ~ 1.05
    let newPrice = Math.round(c.buyPrice * change)
    const minPrice = Math.round(c.basePrice * 0.6)
    const maxPrice = Math.round(c.basePrice * 2.0)
    c.buyPrice = Math.max(minPrice, Math.min(maxPrice, newPrice))
  }

  // 5% 概率触发事件
  if (Math.random() < 0.05 && !activeNewsEvent) {
    const evt = newsEvents[Math.floor(Math.random() * newsEvents.length)]
    activeNewsEvent = evt
    // 给对应企业加价
    const cropCfg = ALL_CROPS[evt.cropId]
    if (cropCfg) {
      const companyId = cropCfg.companyId
      if (companyPrices[companyId]) {
        companyPrices[companyId].event = { title: evt.title, multiplier: evt.multiplier }
        companyPrices[companyId].buyPrice = Math.round(companyPrices[companyId].basePrice * evt.multiplier)
      }
    }
    // 2 分钟后事件结束
    if (newsTimer) clearTimeout(newsTimer)
    newsTimer = setTimeout(() => {
      if (activeNewsEvent) {
        const cropCfg = ALL_CROPS[activeNewsEvent.cropId]
        if (cropCfg) {
          const cid = cropCfg.companyId
          if (companyPrices[cid]) {
            companyPrices[cid].event = null
            companyPrices[cid].buyPrice = companyPrices[cid].basePrice
          }
        }
        activeNewsEvent = null
      }
    }, 2 * 60 * 1000)
  }
}, 30 * 1000)

export async function mockFetchCompanies(): Promise<CompanyInfo[]> {
  await delay(200)
  return Object.entries(COMPANIES).map(([id, cfg]) => {
    const cropCfg = ALL_CROPS[cfg.buyItem]
    const priceInfo = companyPrices[id]
    return {
      company_id: id,
      name: cfg.name,
      emoji: cfg.emoji,
      description: cfg.description,
      buy_item: cfg.buyItem,
      buy_item_name: cropCfg?.name ?? cfg.buyItem,
      buy_item_emoji: cropCfg?.emoji ?? '📦',
      buy_price: priceInfo?.buyPrice ?? cropCfg?.baseSellPrice ?? 3,
      base_price: priceInfo?.basePrice ?? cropCfg?.baseSellPrice ?? 3,
      event: priceInfo?.event ?? null,
    }
  })
}

export async function mockSellToCompany(
  item: string,
  amount: number
): Promise<SellToCompanyResponse> {
  await delay(300)

  if (amount <= 0) throw { code: 2002, message: '参数无效' }
  if ((user.items[item] ?? 0) < amount) throw { code: 2001, message: '库存不足' }

  const cropCfg = ALL_CROPS[item]
  if (!cropCfg) throw { code: 6001, message: '该作物无企业收购' }

  const companyId = cropCfg.companyId
  const companyCfg = COMPANIES[companyId]
  const priceInfo = companyPrices[companyId]
  const unitPrice = priceInfo?.buyPrice ?? cropCfg.baseSellPrice

  user.items[item] -= amount
  user.gold += amount * unitPrice

  return {
    item,
    amount,
    unit_price: unitPrice,
    total_revenue: amount * unitPrice,
    company_id: companyId,
    company_name: companyCfg?.name ?? '未知企业',
  }
}

/** 获取当前活跃新闻事件（用于跑马灯） */
export function getActiveNewsEvents(): { title: string; cropId: string }[] {
  if (activeNewsEvent) {
    return [{ title: activeNewsEvent.title, cropId: activeNewsEvent.cropId }]
  }
  return []
}
