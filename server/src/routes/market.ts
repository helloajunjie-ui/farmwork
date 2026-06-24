import { Router } from 'express'
import prisma from '../prisma.js'
import { COMPANIES } from '../config/companies.js'
import { CROPS, isValidCrop } from '../config/crops.js'
import { getAllBuyPrices, getBuyPrice } from '../services/priceEngine.js'
import type { AuthRequest } from '../middleware/auth.js'

const router = Router()

function getUserId(req: AuthRequest): number {
  return req.userId!
}

function ok(data: any) {
  return { code: 0, message: 'success', data }
}

function fail(code: number, message: string) {
  return { code, message, data: null }
}

// ===== 1. GET /api/market/orders — 按单价聚合，返回盘口深度 =====
// 支持 ?item_id=xxx 过滤，只返回指定作物的盘口
router.get('/orders', async (req, res) => {
  const userId = getUserId(req)
  const itemId = req.query.item_id as string | undefined

  // MVP 4.3: 如果传了 item_id，只查询该作物的订单
  const itemFilter = itemId ? `AND item = '${itemId.replace(/'/g, "''")}'` : ''

  // 使用原生 SQL GROUP BY 按 unit_price 聚合
  // unit_price = total_price / amount (整数除法，保留整数单价)
  // 返回每个价格层级的总量和订单 ID 列表
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      (total_price / amount) AS unit_price,
      SUM(amount) AS total_amount,
      array_agg(id ORDER BY created_at ASC) AS order_ids
    FROM market_orders
    WHERE status = 'active' ${itemFilter}
    GROUP BY unit_price
    ORDER BY unit_price ASC
  `)

  // 计算全服地板价（最低单价）
  const floorPrice = rows.length > 0 ? Number(rows[0].unit_price) : null

  // 查询用户自己的挂单（用于"我的挂单"标记）
  const myOrders: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, (total_price / amount) AS unit_price, amount, total_price, created_at
    FROM market_orders
    WHERE status = 'active' AND seller_id = $1 ${itemFilter.replace('AND', 'AND')}
    ORDER BY created_at DESC
  `, userId)

  res.json(
    ok({
      depth: rows.map((r: any) => ({
        unit_price: Number(r.unit_price),
        total_amount: Number(r.total_amount),
        order_ids: r.order_ids.map((id: any) => Number(id)),
      })),
      floor_price: floorPrice,
      my_orders: myOrders.map((o: any) => ({
        id: Number(o.id),
        unit_price: Number(o.unit_price),
        amount: Number(o.amount),
        total_price: Number(o.total_price),
        created_at: Math.floor(new Date(o.created_at).getTime() / 1000),
      })),
    })
  )
})

// ===== 2. POST /api/market/sell — 改为接收 unit_price（单价） =====
router.post('/sell', async (req, res) => {
  const userId = getUserId(req)
  const { item, amount, unit_price } = req.body

  if (!item || !amount || !unit_price || amount <= 0 || unit_price <= 0) {
    res.status(400).json(fail(2002, '参数无效'))
    return
  }

  const totalPrice = amount * unit_price

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 锁定库存行
      const inv = await tx.inventory.findUnique({
        where: { userId_item: { userId, item } },
      })
      if (!inv || inv.amount < amount) {
        throw { code: 2001, msg: '库存不足' }
      }

      // 2. 扣减库存（冻结）
      await tx.inventory.update({
        where: { userId_item: { userId, item } },
        data: { amount: { decrement: amount } },
      })

      // 3. 创建订单
      await tx.marketOrder.create({
        data: {
          sellerId: userId,
          item,
          amount,
          totalPrice,
        },
      })
    })

    res.json(ok({ status: 'active' }))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '发布失败'))
  }
})

// ===== 3. POST /api/market/buy — 命门：行级锁防并发 =====
router.post('/buy', async (req, res) => {
  const buyerId = getUserId(req)
  const { order_id } = req.body

  if (!order_id) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ⚠️ 关键：使用行级锁锁定订单行，防止并发购买
      // Prisma 通过 $queryRawUnsafe 注入 SELECT ... FOR UPDATE
      const orders: any[] = await tx.$queryRawUnsafe(
        `SELECT id, seller_id, item, amount, total_price, status
         FROM market_orders
         WHERE id = $1
         FOR UPDATE`,
        order_id
      )

      if (orders.length === 0) {
        throw { code: 2101, msg: '订单不存在' }
      }

      const order = orders[0]

      if (order.status !== 'active') {
        throw { code: 2101, msg: '订单已售出' }
      }
      if (order.seller_id === buyerId) {
        throw { code: 2102, msg: '不能购买自己的订单' }
      }

      // 锁定买家金币行
      const buyers: any[] = await tx.$queryRawUnsafe(
        `SELECT user_id, gold FROM users WHERE user_id = $1 FOR UPDATE`,
        buyerId
      )
      if (buyers.length === 0) {
        throw { code: 9002, msg: '买家不存在' }
      }
      if (buyers[0].gold < order.total_price) {
        throw { code: 2103, msg: '金币不足' }
      }

      // 原子操作：扣买家金币 → 加卖家金币 → 给买家物品 → 更新订单状态
      const totalPrice = Number(order.total_price)
      const amount = Number(order.amount)
      const sellerId = Number(order.seller_id)
      const item = order.item

      // 扣买家金币
      await tx.$executeRawUnsafe(
        `UPDATE users SET gold = gold - $1 WHERE user_id = $2`,
        totalPrice,
        buyerId
      )

      // 加卖家金币
      await tx.$executeRawUnsafe(
        `UPDATE users SET gold = gold + $1 WHERE user_id = $2`,
        totalPrice,
        sellerId
      )

      // 给买家加物品
      await tx.$executeRawUnsafe(
        `INSERT INTO inventory (user_id, item, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item)
         DO UPDATE SET amount = inventory.amount + $3`,
        buyerId,
        item,
        amount
      )

      // 更新订单状态
      await tx.$executeRawUnsafe(
        `UPDATE market_orders SET status = 'sold', updated_at = NOW() WHERE id = $1`,
        order_id
      )

      // 查询买家剩余金币
      const buyerResult: any[] = await tx.$queryRawUnsafe(
        `SELECT gold FROM users WHERE user_id = $1`,
        buyerId
      )

      return {
        order_id,
        item,
        amount,
        cost: totalPrice,
        gold_remaining: Number(buyerResult[0].gold),
      }
    })

    res.json(ok(result))
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '购买失败'))
  }
})

// ===== 4. GET /api/market/companies — 获取企业收购价 =====
router.get('/companies', async (_req, res) => {
  const prices = await getAllBuyPrices()

  const data = Object.values(COMPANIES).map((c) => {
    const p = prices[c.id]
    const crop = CROPS[c.buyItem]
    return {
      company_id: c.id,
      name: c.name,
      emoji: c.emoji,
      description: c.description,
      buy_item: c.buyItem,
      buy_item_name: crop?.name ?? c.buyItem,
      buy_item_emoji: crop?.emoji ?? '',
      buy_price: p.buyPrice,
      base_price: p.basePrice,
      event: p.event ?? null,
    }
  })

  res.json(ok(data))
})

// ===== 5. POST /api/market/sell-to-company — 玩家直接卖给企业 =====
router.post('/sell-to-company', async (req, res) => {
  const userId = getUserId(req)
  const { item, amount } = req.body

  if (!item || !amount || amount <= 0 || !Number.isInteger(amount)) {
    res.status(400).json(fail(9001, '参数校验失败'))
    return
  }

  if (!isValidCrop(item)) {
    res.json(fail(1003, '不支持的作物'))
    return
  }

  const crop = CROPS[item]
  const buyPrice = await getBuyPrice(item)

  if (buyPrice <= 0) {
    res.json(fail(6001, '当前无企业收购该作物'))
    return
  }

  const totalRevenue = amount * buyPrice

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 锁定玩家库存
      const inv = await tx.inventory.findUnique({
        where: { userId_item: { userId, item } },
      })
      if (!inv || inv.amount < amount) {
        throw { code: 2001, msg: '库存不足' }
      }

      // 2. 扣库存
      await tx.inventory.update({
        where: { userId_item: { userId, item } },
        data: { amount: { decrement: amount } },
      })

      // 3. 加金币
      await tx.user.update({
        where: { userId },
        data: { gold: { increment: totalRevenue } },
      })
    })

    res.json(
      ok({
        item,
        amount,
        unit_price: buyPrice,
        total_revenue: totalRevenue,
        company_id: crop.companyId,
        company_name: COMPANIES[crop.companyId].name,
      })
    )
  } catch (e: any) {
    res.json(fail(e.code || 9999, e.msg || '出售失败'))
  }
})

export default router
