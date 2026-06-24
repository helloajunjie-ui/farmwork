import { Router } from 'express'
import prisma from '../prisma.js'
import { CROPS, isValidCrop } from '../config/crops.js'
import { getSeedPrice } from '../services/priceEngine.js'
import { settleUpkeep } from '../middleware/upkeep.js'
import type { AuthRequest } from '../middleware/auth.js'

const router = Router()

// 土地解锁价格（指数递增）：第 7~12 块地
const UNLOCK_PRICES: Record<number, number> = {
  7: 100,
  8: 500,
  9: 2000,
  10: 8000,
  11: 32000,
  12: 128000,
}

// ===== 工具 =====
function getUserId(req: AuthRequest): number {
  return req.userId!
}

function ok(data: any) {
  return { code: 0, message: 'success', data }
}

function fail(code: number, message: string) {
  return { code, message, data: null }
}

/** 获取作物的生长周期（秒） */
function getGrowDuration(crop: string): number {
  return CROPS[crop]?.growDuration ?? 28
}

// ===== 打工牛离线结算 =====
// O(1) 时间差公式：不依赖定时任务，玩家请求时实时计算
// 支持多作物：按作物类型分别结算
async function syncCow(userId: number) {
  const cow = await prisma.cow.findUnique({ where: { userId } })
  if (!cow || !cow.active) return // 没有牛或未启用

  const now = new Date()
  const elapsed = (now.getTime() - cow.lastSyncAt.getTime()) / 1000 // 秒

  // 获取玩家所有已种植的土地（不限作物）
  const plantedPlots = await prisma.plot.findMany({
    where: { userId, status: 'growing' },
  })

  if (plantedPlots.length === 0) return // 没有种东西

  // 按作物分组
  const cropGroups = new Map<string, number>()
  for (const p of plantedPlots) {
    if (p.crop) {
      cropGroups.set(p.crop, (cropGroups.get(p.crop) ?? 0) + 1)
    }
  }

  // 检查种子库存（通用种子）
  const seedInv = await prisma.inventory.findUnique({
    where: { userId_item: { userId, item: 'seed' } },
  })
  const availableSeeds = seedInv?.amount ?? 0

  // 计算每种作物需要消耗的种子总数
  let totalSeedNeeded = 0
  for (const [crop, count] of cropGroups) {
    const config = CROPS[crop]
    if (!config) continue
    const growDuration = config.growDuration
    if (elapsed < growDuration) continue // 不够一轮
    const cycles = Math.floor(elapsed / growDuration)
    totalSeedNeeded += count * cycles
  }

  if (totalSeedNeeded <= 0) return

  // 实际可执行的种子消耗（受种子限制）
  const seedRatio = Math.min(1, availableSeeds / totalSeedNeeded)

  // 事务执行批量结算
  await prisma.$transaction(async (tx) => {
    let totalSeedCost = 0

    for (const [crop, count] of cropGroups) {
      const config = CROPS[crop]
      if (!config) continue
      const growDuration = config.growDuration
      if (elapsed < growDuration) continue

      const cycles = Math.floor(elapsed / growDuration)
      const actualCycles = Math.max(1, Math.floor(cycles * seedRatio))
      const harvestAmount = count * actualCycles * config.yieldPerPlot
      const seedCost = count * actualCycles

      if (harvestAmount <= 0) continue

      // 加作物
      await tx.inventory.upsert({
        where: { userId_item: { userId, item: crop } },
        create: { userId, item: crop, amount: harvestAmount },
        update: { amount: { increment: harvestAmount } },
      })

      totalSeedCost += seedCost

      console.log(
        `🐮 玩家 ${userId} 打工牛结算: ${crop} x${count}, ${actualCycles} 轮, +${harvestAmount}`
      )
    }

    // 扣种子
    if (totalSeedCost > 0) {
      await tx.inventory.update({
        where: { userId_item: { userId, item: 'seed' } },
        data: { amount: { decrement: totalSeedCost } },
      })
    }

    // 更新同步时间
    await tx.cow.update({
      where: { userId },
      data: { lastSyncAt: now },
    })
  })
}

// ===== 1. GET /api/farm/plots =====
router.get('/plots', async (req, res) => {
  const userId = getUserId(req)

  // 先执行地租结算
  await settleUpkeep(userId)

  // 再执行打工牛离线结算
  await syncCow(userId)

  const plots = await prisma.plot.findMany({
    where: { userId },
    orderBy: { plotId: 'asc' },
  })

  const now = Math.floor(Date.now() / 1000)
  const data = plots.map((p) => {
    if (p.status === 'locked') {
      return {
        plot_id: p.plotId,
        status: 'locked',
        planted_at: null,
        crop: null,
        remaining_seconds: 0,
        unlock_price: UNLOCK_PRICES[p.plotId] ?? null,
      }
    }
    if (p.status === 'idle' || !p.plantedAt) {
      return {
        plot_id: p.plotId,
        status: 'idle',
        planted_at: null,
        crop: null,
        remaining_seconds: 0,
        unlock_price: null,
      }
    }
    const planted = Math.floor(p.plantedAt.getTime() / 1000)
    const elapsed = now - planted
    const growDuration = getGrowDuration(p.crop ?? 'corn')
    if (elapsed >= growDuration) {
      return {
        plot_id: p.plotId,
        status: 'ready',
        planted_at: planted,
        crop: p.crop,
        remaining_seconds: 0,
        unlock_price: null,
      }
    }
    return {
      plot_id: p.plotId,
      status: 'growing',
      planted_at: planted,
      crop: p.crop,
      remaining_seconds: growDuration - elapsed,
      unlock_price: null,
    }
  })

  res.json(ok(data))
})

// ===== 2. POST /api/farm/plant =====
router.post('/plant', async (req, res) => {
  const userId = getUserId(req)
  const { plot_id, crop } = req.body

  if (!plot_id || !crop) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }
  if (!isValidCrop(crop)) {
    res.json(fail(1003, '不支持的作物'))
    return
  }

  const cropConfig = CROPS[crop]
  const seedItem = `seed_${crop}`

  try {
    await prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUnique({
        where: { plotId_userId: { plotId: plot_id, userId } },
      })
      if (!plot) throw { code: 9001, msg: '土地不存在' }
      if (plot.status !== 'idle') throw { code: 1001, msg: '土地不可用' }

      // 🔴 V1.0.1: 按作物区分种子 — 消耗 seed_{cropId}
      const inv = await tx.inventory.findUnique({
        where: { userId_item: { userId, item: seedItem } },
      })
      if (!inv || inv.amount < 1) throw { code: 1002, msg: `${cropConfig.name}种子不足` }

      await tx.inventory.update({
        where: { userId_item: { userId, item: seedItem } },
        data: { amount: { decrement: 1 } },
      })

      await tx.plot.update({
        where: { plotId_userId: { plotId: plot_id, userId } },
        data: { plantedAt: new Date(), crop, status: 'growing' },
      })
    })

    res.json(ok({ plot_id, status: 'growing', crop }))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '播种失败'))
  }
})

// ===== 3. POST /api/farm/harvest =====
router.post('/harvest', async (req, res) => {
  const userId = getUserId(req)
  const { plot_id } = req.body

  if (!plot_id) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUnique({
        where: { plotId_userId: { plotId: plot_id, userId } },
      })
      if (!plot) throw { code: 9001, msg: '土地不存在' }
      if (plot.status !== 'ready') throw { code: 1101, msg: '该土地未播种或未成熟' }

      // 🔴 V1.0.1: 空值熔断 — 严禁默认给 corn
      if (!plot.crop) throw { code: 1103, msg: '异常地块数据：作物信息缺失' }
      const crop = plot.crop
      const cropConfig = CROPS[crop]
      if (!cropConfig) throw { code: 1003, msg: '未知作物' }

      const growDuration = cropConfig.growDuration
      const elapsed = (Date.now() - plot.plantedAt!.getTime()) / 1000
      if (elapsed < growDuration) {
        throw { code: 1102, msg: '作物尚未成熟' }
      }

      const harvested = cropConfig.yieldPerPlot

      await tx.inventory.upsert({
        where: { userId_item: { userId, item: crop } },
        create: { userId, item: crop, amount: harvested },
        update: { amount: { increment: harvested } },
      })

      await tx.plot.update({
        where: { plotId_userId: { plotId: plot_id, userId } },
        data: { plantedAt: null, crop: null, status: 'idle' },
      })

      const inventory = await tx.inventory.findMany({ where: { userId } })
      const items: Record<string, number> = {}
      inventory.forEach((inv: any) => { items[inv.item] = inv.amount })

      return { plot_id, status: 'idle', harvested, crop, items }
    })

    res.json(ok(result))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '收割失败'))
  }
})

// ===== 4. POST /api/farm/unlock — 解锁土地 =====
router.post('/unlock', async (req, res) => {
  const userId = getUserId(req)
  const { plot_id } = req.body

  if (!plot_id) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }

  const price = UNLOCK_PRICES[plot_id]
  if (!price) {
    res.json(fail(3001, '该土地无需解锁'))
    return
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 锁定土地行
      const plot = await tx.plot.findUnique({
        where: { plotId_userId: { plotId: plot_id, userId } },
      })
      if (!plot) throw { code: 9001, msg: '土地不存在' }
      if (plot.status !== 'locked') throw { code: 3002, msg: '土地已解锁' }

      // 锁定玩家金币
      const user = await tx.user.findUnique({ where: { userId } })
      if (!user || user.gold < price) {
        throw { code: 3003, msg: `金币不足，需要 ${price} 金币` }
      }

      // 扣金币 + 解锁土地
      await tx.user.update({
        where: { userId },
        data: { gold: { decrement: price } },
      })
      await tx.plot.update({
        where: { plotId_userId: { plotId: plot_id, userId } },
        data: { status: 'idle' },
      })
    })

    res.json(ok({ plot_id, status: 'idle', cost: price }))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '解锁失败'))
  }
})

// ===== 5. POST /api/farm/buy-cow — 购买打工牛 =====
router.post('/buy-cow', async (req, res) => {
  const userId = getUserId(req)
  const COW_PRICE = 5000

  try {
    await prisma.$transaction(async (tx) => {
      // 检查是否已有牛
      const existing = await tx.cow.findUnique({ where: { userId } })
      if (existing) throw { code: 4001, msg: '你已经拥有一头打工牛了' }

      // 锁定玩家金币
      const user = await tx.user.findUnique({ where: { userId } })
      if (!user || user.gold < COW_PRICE) {
        throw { code: 4002, msg: `金币不足，需要 ${COW_PRICE} 金币` }
      }

      // 扣金币 + 创建牛
      await tx.user.update({
        where: { userId },
        data: { gold: { decrement: COW_PRICE } },
      })
      await tx.cow.create({
        data: { userId, lastSyncAt: new Date() },
      })
    })

    res.json(ok({ message: '🎉 恭喜你成为资本家！打工牛已就位' }))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '购买失败'))
  }
})

// ===== 6. GET /api/farm/cow-status — 查询打工牛状态 =====
router.get('/cow-status', async (req, res) => {
  const userId = getUserId(req)
  const cow = await prisma.cow.findUnique({ where: { userId } })
  res.json(
    ok({
      has_cow: !!cow,
      active: cow?.active ?? false,
      last_sync_at: cow ? Math.floor(cow.lastSyncAt.getTime() / 1000) : null,
    })
  )
})

// ===== 7. POST /api/farm/buy-seed — 系统商店购买种子 =====
// 种子价格因作物而异，从 crops.ts 配置读取
// MVP 4.0: 种子价格与厂家收购价联动（相位延迟），高回报伴随高成本

router.post('/buy-seed', async (req, res) => {
  const userId = getUserId(req)
  const { amount, crop } = req.body

  if (!amount || amount <= 0 || !Number.isInteger(amount)) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }

  // 🔴 V1.0.1: crop 参数必传，不再默认 corn
  if (!crop || !isValidCrop(crop)) {
    res.status(400).json(fail(9001, '请指定要购买的作物种子'))
    return
  }

  const cropId = crop
  const cropConfig = CROPS[cropId]
  const seedItem = `seed_${cropId}`

  // 动态种子价（相位延迟引擎）
  const seedPrice = await getSeedPrice(cropId)
  const totalCost = amount * seedPrice

  try {
    await prisma.$transaction(async (tx) => {
      // 锁定玩家金币
      const user = await tx.user.findUnique({ where: { userId } })
      if (!user || user.gold < totalCost) {
        throw { code: 5001, msg: `金币不足，需要 ${totalCost} 金币` }
      }

      // 扣金币 + 加种子（按作物区分：seed_{cropId}）
      await tx.user.update({
        where: { userId },
        data: { gold: { decrement: totalCost } },
      })
      await tx.inventory.upsert({
        where: { userId_item: { userId, item: seedItem } },
        create: { userId, item: seedItem, amount },
        update: { amount: { increment: amount } },
      })
    })

    res.json(ok({ amount, cost: totalCost, price_per_unit: seedPrice, crop: cropId }))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '购买失败'))
  }
})

// ===== 8. GET /api/farm/seed-price — 获取动态种子价格 =====
router.get('/seed-price', async (req, res) => {
  const crop = String(req.query.crop || 'corn')
  if (!isValidCrop(crop)) {
    res.json(fail(1003, '不支持的作物'))
    return
  }
  const price = await getSeedPrice(crop)
  res.json(ok({ price, crop }))
})

export default router
