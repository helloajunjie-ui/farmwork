// ===== 价格波动引擎 =====
// 设计原则：
// - 轻量级：setInterval 定时任务，无需外部消息队列
// - 随机游走：每 60 秒对每个企业价格做 -5% ~ +5% 随机波动
// - 宏观事件：极低概率触发限时事件（~5%），价格飙升 50%
// - 价格钳制：收购价不低于基准价的 60%，不高于基准价的 200%
// - 相位延迟种子定价：种子价格滞后于收购价变动，创造套利窗口

import prisma from '../prisma.js'
import { COMPANIES, COMPANY_IDS } from '../config/companies.js'
import { CROPS } from '../config/crops.js'

const TICK_INTERVAL = 60 * 1000 // 每 60 秒波动一次
const EVENT_CHANCE = 0.05       // 每次 tick 5% 概率触发事件
const EVENT_DURATION = 2 * 60 * 60 * 1000 // 事件持续 2 小时

// 相位延迟参数
const PHASE_LAG_STEPS = 5       // 分 5 步追赶上目标价（约 5 分钟）
const SEED_PRICE_FACTOR = 0.8   // 种子价格 = 基础价 + (收购价 - 基础价) * 0.8

// 种子目标价缓存：{ cropId: targetPrice }
const seedTargetPrices: Record<string, number> = {}

// 事件模板（覆盖所有 5 个分类）
const EVENT_TEMPLATES = [
  // 谷物类
  { eventType: 'wheat_blight', title: '🌾 小麦锈病爆发！面粉厂紧急采购！', cropId: 'wheat', multiplier: 1.5 },
  { eventType: 'corn_festival', title: '🌽 玉米丰收节！饲料厂大量囤货！', cropId: 'corn', multiplier: 1.5 },
  { eventType: 'rice_shortage', title: '🍚 水稻产区干旱！米价飙升！', cropId: 'rice', multiplier: 1.6 },
  { eventType: 'sorghum_boom', title: '🌾 饲料级高粱需求暴增！', cropId: 'sorghum', multiplier: 1.4 },
  // 蔬菜类
  { eventType: 'cabbage_fest', title: '🥬 泡菜节！大润发紧急采购白菜！', cropId: 'cabbage', multiplier: 1.5 },
  { eventType: 'tomato_fever', title: '🍅 番茄酱厂原料告急！', cropId: 'tomato', multiplier: 1.4 },
  { eventType: 'garlic_king', title: '🧄 大蒜价格创历史新高！', cropId: 'garlic', multiplier: 1.6 },
  // 水果类
  { eventType: 'apple_juice', title: '🧃 果汁出口订单暴增！苹果需求旺盛！', cropId: 'apple', multiplier: 1.5 },
  { eventType: 'grape_wine', title: '🍇 葡萄酒年份评级优异！葡萄抢购！', cropId: 'grape', multiplier: 1.5 },
  { eventType: 'cherry_luxury', title: '🍒 高端水果市场火爆！樱桃供不应求！', cropId: 'cherry', multiplier: 1.7 },
  // 经济作物
  { eventType: 'cotton_rush', title: '☁️ 纺织厂订单排到明年！棉花暴涨！', cropId: 'cotton', multiplier: 1.5 },
  { eventType: 'sugar_crisis', title: '🍬 国际糖价飙升！甜菜收购价大涨！', cropId: 'sugar_beet', multiplier: 1.5 },
  { eventType: 'coffee_blight', title: '☕ 南美咖啡减产！国产咖啡豆替代需求！', cropId: 'coffee', multiplier: 1.6 },
  // 珍稀草药
  { eventType: 'ginseng_boom', title: '🌱 保健品市场需求井喷！人参价格翻倍！', cropId: 'ginseng', multiplier: 1.8 },
  { eventType: 'saffron_king', title: '🌸 顶级餐厅抢购藏红花！价格暴涨！', cropId: 'saffron', multiplier: 1.8 },
  { eventType: 'cordyceps_craze', title: '🐛 冬虫夏草被列为国礼！价格冲天！', cropId: 'cordyceps', multiplier: 2.0 },
]

let tickTimer: ReturnType<typeof setInterval> | null = null

/** 初始化价格：将各企业的基准价写入 market_environment */
export async function initPrices() {
  for (const company of Object.values(COMPANIES)) {
    await prisma.marketEnvironment.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, buyPrice: company.basePrice },
      update: {}, // 不覆盖已有价格
    })
  }
  console.log(`[价格引擎] 初始收购价已写入 (${COMPANY_IDS.length} 家企业)`)
}

/** 单次价格波动 */
async function tick() {
  try {
    // 1. 随机游走：每个企业价格波动 -5% ~ +5%
    for (const companyId of COMPANY_IDS) {
      const env = await prisma.marketEnvironment.findUnique({
        where: { companyId },
      })
      if (!env) continue

      const config = COMPANIES[companyId]
      const change = 1 + (Math.random() - 0.5) * 0.1 // 0.95 ~ 1.05
      let newPrice = Math.round(env.buyPrice * change)

      // 钳制：不低于基准价 60%，不高于基准价 200%
      const minPrice = Math.round(config.basePrice * 0.6)
      const maxPrice = Math.round(config.basePrice * 2.0)
      newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice))

      await prisma.marketEnvironment.update({
        where: { companyId },
        data: { buyPrice: newPrice },
      })

      // 更新该企业对应作物的种子目标价（相位延迟）
      const cropId = config.buyItem
      const cropConfig = CROPS[cropId]
      if (cropConfig) {
        const baseSeedPrice = cropConfig.baseSeedPrice
        const baseBuyPrice = config.basePrice
        const targetSeedPrice = Math.max(
          baseSeedPrice,
          Math.round(baseSeedPrice + (newPrice - baseBuyPrice) * SEED_PRICE_FACTOR)
        )
        seedTargetPrices[cropId] = targetSeedPrice
      }
    }

    // 2. 检查是否有活跃事件已过期
    const now = new Date()
    await prisma.marketEvent.deleteMany({
      where: { expiresAt: { lte: now } },
    })

    // 3. 概率触发新事件
    if (Math.random() < EVENT_CHANCE) {
      const template =
        EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)]

      // 检查是否已有同类型活跃事件
      const existing = await prisma.marketEvent.findFirst({
        where: { eventType: template.eventType, expiresAt: { gt: now } },
      })
      if (!existing) {
        await prisma.marketEvent.create({
          data: {
            eventType: template.eventType,
            title: template.title,
            cropId: template.cropId,
            multiplier: template.multiplier,
            expiresAt: new Date(now.getTime() + EVENT_DURATION),
          },
        })
        console.log(`[价格引擎] 事件触发: ${template.title}`)
      }
    }
  } catch (e) {
    console.error('[价格引擎] tick 错误:', e)
  }
}

/** 获取某个作物的当前企业收购价（含事件倍率） */
export async function getBuyPrice(cropId: string): Promise<number> {
  const crop = CROPS[cropId]
  if (!crop) return 0

  const env = await prisma.marketEnvironment.findUnique({
    where: { companyId: crop.companyId },
  })
  if (!env) return 0

  let price = env.buyPrice

  // 检查是否有影响该作物的活跃事件
  const now = new Date()
  const activeEvent = await prisma.marketEvent.findFirst({
    where: { cropId, expiresAt: { gt: now } },
    orderBy: { startedAt: 'desc' },
  })

  if (activeEvent) {
    price = Math.round(price * activeEvent.multiplier)
  }

  return price
}

/** 获取所有企业的当前收购价（含事件倍率） */
export async function getAllBuyPrices(): Promise<
  Record<string, { buyPrice: number; basePrice: number; event?: { title: string; multiplier: number } }>
> {
  const now = new Date()
  const activeEvents = await prisma.marketEvent.findMany({
    where: { expiresAt: { gt: now } },
  })

  const result: Record<string, { buyPrice: number; basePrice: number; event?: { title: string; multiplier: number } }> = {}

  for (const company of Object.values(COMPANIES)) {
    const env = await prisma.marketEnvironment.findUnique({
      where: { companyId: company.id },
    })
    let buyPrice = env?.buyPrice ?? company.basePrice
    let event: { title: string; multiplier: number } | undefined

    const activeEvent = activeEvents.find((e: { cropId: string }) => e.cropId === company.buyItem)
    if (activeEvent) {
      buyPrice = Math.round(buyPrice * activeEvent.multiplier)
      event = { title: activeEvent.title, multiplier: activeEvent.multiplier }
    }

    result[company.id] = { buyPrice, basePrice: company.basePrice, event }
  }

  return result
}

/** 启动价格引擎 */
export function startPriceEngine() {
  if (tickTimer) return
  console.log('[价格引擎] 启动')
  tick() // 立即执行一次
  tickTimer = setInterval(tick, TICK_INTERVAL)
}

/** 停止价格引擎 */
export function stopPriceEngine() {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
    console.log('[价格引擎] 停止')
  }
}

/** 初始化种子目标价（启动时调用） */
export async function initSeedPrices() {
  for (const company of Object.values(COMPANIES)) {
    const env = await prisma.marketEnvironment.findUnique({
      where: { companyId: company.id },
    })
    const buyPrice = env?.buyPrice ?? company.basePrice
    const cropConfig = CROPS[company.buyItem]
    if (cropConfig) {
      const baseSeedPrice = cropConfig.baseSeedPrice
      const baseBuyPrice = company.basePrice
      seedTargetPrices[company.buyItem] = Math.max(
        baseSeedPrice,
        Math.round(baseSeedPrice + (buyPrice - baseBuyPrice) * SEED_PRICE_FACTOR)
      )
    }
  }
  console.log(`[价格引擎] 种子目标价已初始化 (${Object.keys(seedTargetPrices).length} 种作物)`)
}

/**
 * 获取某个作物的当前种子售价（含相位延迟）
 * 种子价格不会瞬间追上收购价，而是分步追赶，创造套利窗口
 */
export async function getSeedPrice(cropId: string): Promise<number> {
  const cropConfig = CROPS[cropId]
  if (!cropConfig) return 0

  const baseSeedPrice = cropConfig.baseSeedPrice

  // 如果没有目标价（引擎未启动），返回基础价
  const targetPrice = seedTargetPrices[cropId]
  if (!targetPrice) return baseSeedPrice

  const company = Object.values(COMPANIES).find((c) => c.buyItem === cropId)
  if (!company) return baseSeedPrice

  const env = await prisma.marketEnvironment.findUnique({
    where: { companyId: company.id },
  })
  if (!env) return baseSeedPrice

  // 相位延迟公式：种子价向目标价缓慢移动
  const diff = targetPrice - baseSeedPrice
  const phasePrice = Math.round(
    baseSeedPrice + diff * (1 - Math.pow(1 - 1 / PHASE_LAG_STEPS, 3))
  )

  return Math.max(baseSeedPrice, phasePrice)
}
