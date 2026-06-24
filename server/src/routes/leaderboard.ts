import { Router } from 'express'
import prisma from '../prisma.js'
import { getAllBuyPrices } from '../services/priceEngine.js'
import { CROPS } from '../config/economy_matrix.js'
import type { AuthRequest } from '../middleware/auth.js'

const router = Router()

// 每块土地的固定估值
const PLOT_VALUATION = 1000

// 排行榜前 N 名
const TOP_N = 50

interface PlayerEntry {
  user_id: number
  nickname: string
  gold: number
  unlocked_plots: number
  land_value: number
  inventory_value: number
  net_worth: number
}

/**
 * GET /api/leaderboard — 双轨制净值排行榜
 *
 * 动态净值公式：
 *   总净值 = 现金(金币) + (地块数 × 1000估值) + ∑(每种作物库存 × 该作物当前企业收购价)
 *
 * 返回两个阵营：
 *   - farmers: 农夫新星榜 (已解锁土地 ≤ 6块)
 *   - capitalists: 资本巨鳄榜 (已解锁土地 > 6块)
 */
router.get('/', async (_req: AuthRequest, res) => {
  try {
    // 1. 获取所有用户的土地数和库存
    const users = await prisma.user.findMany({
      select: {
        userId: true,
        nickname: true,
        gold: true,
        _count: {
          select: {
            plots: {
              where: { status: { not: 'locked' } },
            },
          },
        },
        inventory: {
          select: {
            item: true,
            amount: true,
          },
        },
      },
    })

    // 2. 获取当前所有企业的收购价（含事件倍率）
    const buyPrices = await getAllBuyPrices()

    // 3. 计算每个玩家的净值
    const allPlayers: PlayerEntry[] = users.map((user) => {
      const unlockedPlots = user._count.plots
      const landValue = unlockedPlots * PLOT_VALUATION

      // 计算库存估值：∑(每种作物库存 × 该作物当前企业收购价)
      let inventoryValue = 0
      for (const inv of user.inventory) {
        if (inv.item === 'seed') continue // 种子不计入净值
        const crop = CROPS[inv.item]
        if (!crop) continue
        const companyId = crop.companyId
        const price = buyPrices[companyId]?.buyPrice ?? 0
        inventoryValue += inv.amount * price
      }

      const netWorth = user.gold + landValue + inventoryValue

      return {
        user_id: user.userId,
        nickname: user.nickname || '匿名农夫',
        gold: user.gold,
        unlocked_plots: unlockedPlots,
        land_value: landValue,
        inventory_value: inventoryValue,
        net_worth: netWorth,
      }
    })

    // 4. 按净值降序排列
    allPlayers.sort((a: PlayerEntry, b: PlayerEntry) => b.net_worth - a.net_worth)

    // 5. 分为两个阵营
    const farmers = allPlayers
      .filter((p: PlayerEntry) => p.unlocked_plots <= 6)
      .slice(0, TOP_N)
      .map((p: PlayerEntry, i: number) => ({ rank: i + 1, ...p }))

    const capitalists = allPlayers
      .filter((p: PlayerEntry) => p.unlocked_plots > 6)
      .slice(0, TOP_N)
      .map((p: PlayerEntry, i: number) => ({ rank: i + 1, ...p }))

    res.json({
      code: 0,
      message: 'success',
      data: {
        farmers,
        capitalists,
        updated_at: Date.now(),
      },
    })
  } catch (e: any) {
    console.error('[排行榜] 计算失败:', e)
    res.status(500).json({ code: 9999, message: '排行榜计算失败', data: null })
  }
})

export default router
