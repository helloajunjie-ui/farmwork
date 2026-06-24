// ===== 地租结算中间件 =====
// 设计原则：
// - O(1) 时间差公式：不依赖定时任务，玩家请求时实时计算
// - 指数递增：10 块地以内免地租，之后呈平方级增长
// - 自动清算：余额不足时触发强制收地

import prisma from '../prisma.js'

// 地租参数
const FREE_PLOTS = 10          // 免地租土地数
const UPKEEP_BASE = 0.5        // 地租基数
const LIQUIDATION_REFUND = 5   // 每块被收回土地的救济金

/**
 * 计算玩家当前地租率（金币/分钟）
 * 公式：unlocked > 10 ? (unlocked - 10)² × 0.5 : 0
 */
function calcUpkeepRate(unlockedPlots: number): number {
  if (unlockedPlots <= FREE_PLOTS) return 0
  const excess = unlockedPlots - FREE_PLOTS
  return Math.round(excess * excess * UPKEEP_BASE * 100) / 100
}

/**
 * 结算玩家地租
 * 在每次玩家发起 API 请求时静默执行
 */
export async function settleUpkeep(userId: number) {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: {
      plots: { where: { status: { not: 'locked' } } },
    },
  })
  if (!user) return

  const unlockedCount = user.plots.length
  const upkeepRate = calcUpkeepRate(unlockedCount)

  // 更新地租率（可能已变化）
  if (user.upkeepRate !== upkeepRate) {
    await prisma.user.update({
      where: { userId },
      data: { upkeepRate },
    })
  }

  // 如果地租率为 0，无需结算
  if (upkeepRate <= 0) return

  // 计算自上次结算以来应扣的地租
  const now = new Date()
  const elapsedMinutes =
    (now.getTime() - user.lastUpkeepAt.getTime()) / 1000 / 60

  // 最多结算 60 分钟（防止离线太久一次性扣光）
  const cappedMinutes = Math.min(elapsedMinutes, 60)
  const totalUpkeep = Math.ceil(cappedMinutes * upkeepRate)

  if (totalUpkeep <= 0) {
    // 更新结算时间
    await prisma.user.update({
      where: { userId },
      data: { lastUpkeepAt: now },
    })
    return
  }

  // 尝试扣地租，如果余额不足则触发清算
  let remainingGold = user.gold - totalUpkeep

  if (remainingGold >= 0) {
    // 余额充足，正常扣地租
    await prisma.user.update({
      where: { userId },
      data: {
        gold: { decrement: totalUpkeep },
        lastUpkeepAt: now,
      },
    })
    console.log(`[地租] 玩家 ${userId} 扣除 ${totalUpkeep} 金币地租`)
  } else {
    // 余额不足，触发清算
    await liquidate(userId, user.gold, totalUpkeep, now)
  }
}

/**
 * 破产清算
 * 从最高编号土地开始收回，每块返还 LIQUIDATION_REFUND 救济金
 */
async function liquidate(
  userId: number,
  currentGold: number,
  totalUpkeep: number,
  now: Date
) {
  // 获取玩家所有已解锁土地（按 plotId 降序）
  const unlockedPlots = await prisma.plot.findMany({
    where: { userId, status: { not: 'locked' } },
    orderBy: { plotId: 'desc' },
  })

  let goldAfterRefund = currentGold
  let plotsToLiquidate = 0

  for (const plot of unlockedPlots) {
    if (goldAfterRefund >= totalUpkeep) break
    goldAfterRefund += LIQUIDATION_REFUND
    plotsToLiquidate++
  }

  // 执行清算
  await prisma.$transaction(async (tx) => {
    // 收回土地
    const plotsToLock = unlockedPlots.slice(0, plotsToLiquidate)
    for (const plot of plotsToLock) {
      await tx.plot.update({
        where: { plotId_userId: { plotId: plot.plotId, userId } },
        data: { status: 'locked', crop: null, plantedAt: null },
      })
    }

    // 发放救济金
    const refundAmount = plotsToLiquidate * LIQUIDATION_REFUND
    const finalGold = currentGold - totalUpkeep + refundAmount

    await tx.user.update({
      where: { userId },
      data: {
        gold: finalGold,
        lastUpkeepAt: now,
        isBankrupt: true,
        upkeepRate: calcUpkeepRate(unlockedPlots.length - plotsToLiquidate),
      },
    })

    console.log(
      `[清算] 玩家 ${userId} 被强制收回 ${plotsToLiquidate} 块土地，` +
        `发放救济金 ${refundAmount} 金币，当前余额 ${finalGold}`
    )
  })
}

export { calcUpkeepRate }
