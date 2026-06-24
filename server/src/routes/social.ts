// ===== MVP 7.0: 社交系统 — 公开名片 & 房产升级 =====
import { Router, Request, Response } from 'express'
import prisma from '../prisma.js'
import { getHousingTier, getNextHousingTier } from '../config/housing_matrix.js'
import { getAllBuyPrices } from '../services/priceEngine.js'
import { CROPS } from '../config/crops.js'

// 扩展 Request 类型，注入 userId
interface AuthRequest extends Request {
  userId?: number
}

const router = Router()

// ===== 获取公开名片 =====
// GET /api/social/profile/:username
// 返回：昵称、头像、房产等级、房产信息、总净值、土地数
router.get('/profile/:username', async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        userId: true,
        nickname: true,
        avatarUrl: true,
        gold: true,
        housingTier: true,
        plots: {
          select: { status: true },
        },
        inventory: {
          select: { item: true, amount: true },
        },
      },
    })

    if (!user) {
      res.status(404).json({ code: 4004, message: '用户不存在', data: null })
      return
    }

    // 计算总净值
    const unlockedPlots = user.plots.filter((p: { status: string }) => p.status !== 'locked').length
    const landValue = unlockedPlots * 1000

    const buyPrices = await getAllBuyPrices()
    let inventoryValue = 0
    for (const inv of user.inventory) {
      if (inv.item === 'seed') continue
      const crop = CROPS[inv.item as keyof typeof CROPS]
      if (!crop) continue
      const price = buyPrices[crop.companyId]?.buyPrice ?? 0
      inventoryValue += inv.amount * price
    }

    const netWorth = user.gold + landValue + inventoryValue
    const housing = getHousingTier(user.housingTier)

    res.json({
      code: 0,
      message: 'success',
      data: {
        user_id: user.userId,
        nickname: user.nickname || '匿名农夫',
        avatar_url: user.avatarUrl,
        housing_tier: user.housingTier,
        housing: {
          name: housing.name,
          emoji: housing.emoji,
          description: housing.description,
          color: housing.color,
          badge: housing.badge,
          total_cost: housing.totalCost,
        },
        unlocked_plots: unlockedPlots,
        net_worth: netWorth,
      },
    })
  } catch (err) {
    console.error('获取名片失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 升级房产 =====
// POST /api/social/upgrade-house
// 请求体：{}
// 返回：升级后的房产信息
router.post('/upgrade-house', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    const user = await prisma.user.findUnique({
      where: { userId },
      select: { gold: true, housingTier: true },
    })

    if (!user) {
      res.status(404).json({ code: 4004, message: '用户不存在', data: null })
      return
    }

    const next = getNextHousingTier(user.housingTier)
    if (!next) {
      res.status(400).json({ code: 7001, message: '已达最高等级，无需升级', data: null })
      return
    }

    if (user.gold < next.cost) {
      res.status(400).json({
        code: 7002,
        message: `金币不足，升级需要 ${next.cost} 🪙`,
        data: null,
      })
      return
    }

    // 事务：扣金币 + 升级
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { userId },
        data: {
          gold: { decrement: next.cost },
          housingTier: next.tier,
        },
      })
    })

    const current = getHousingTier(next.tier)

    res.json({
      code: 0,
      message: `🎉 恭喜升级至 ${current.emoji} ${current.name}！`,
      data: {
        housing_tier: next.tier,
        housing: {
          name: current.name,
          emoji: current.emoji,
          description: current.description,
          color: current.color,
          badge: current.badge,
          total_cost: current.totalCost,
        },
        cost: next.cost,
        gold_remaining: user.gold - next.cost,
      },
    })
  } catch (err) {
    console.error('升级房产失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

export default router
