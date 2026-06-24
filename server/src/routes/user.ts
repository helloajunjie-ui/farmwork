import { Router } from 'express'
import prisma from '../prisma.js'
import { settleUpkeep } from '../middleware/upkeep.js'
import type { AuthRequest } from '../middleware/auth.js'

const router = Router()

// GET /api/user/info — 获取玩家信息及资产
router.get('/info', async (req: AuthRequest, res) => {
  const userId = req.userId!

  // 先结算地租
  await settleUpkeep(userId)

  const user = await prisma.user.findUnique({
    where: { userId },
    include: { inventory: true },
  })

  if (!user) {
    res.status(404).json({ code: 9002, message: '玩家不存在', data: null })
    return
  }

  // 计算已解锁土地数
  const unlockedPlots = await prisma.plot.count({
    where: { userId, status: { not: 'locked' } },
  })

  const items: Record<string, number> = {}
  user.inventory.forEach((inv: { item: string; amount: number }) => {
    items[inv.item] = inv.amount
  })

  // 资金链健康度
  const upkeepRate = user.upkeepRate
  const gold = user.gold
  const minutesRemaining = upkeepRate > 0 ? Math.floor(gold / upkeepRate) : 999

  res.json({
    code: 0,
    message: 'success',
    data: {
      user_id: user.userId,
      nickname: user.nickname,
      gold: user.gold,
      items,
      avatar_url: user.avatarUrl,
      housing_tier: user.housingTier,        // MVP 7.0: 房产等级
      // MVP 4.0: 资金链健康度
      upkeep: {
        rate: upkeepRate,                    // 每分钟地租
        minutes_remaining: minutesRemaining, // 余额可支撑分钟数
        unlocked_plots: unlockedPlots,       // 已解锁土地数
        is_bankrupt: user.isBankrupt,        // 是否破产
      },
    },
  })
})

export default router
