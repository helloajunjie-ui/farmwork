// ===== MVP 8.0: 信箱 / 场外暗池 (OTC Mailbox) =====
import { Router, Request, Response } from 'express'
import prisma from '../prisma.js'
import { CROPS } from '../config/crops.js'

interface AuthRequest extends Request {
  userId?: number
}

const router = Router()

// ===== 获取目标玩家的只读农场数据 =====
// GET /api/social/farm/:username
router.get('/farm/:username', async (req: AuthRequest, res: Response) => {
  try {
    const username = String(req.params.username)
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        userId: true,
        nickname: true,
        housingTier: true,
        plots: {
          orderBy: { plotId: 'asc' },
          select: { plotId: true, status: true, crop: true, plantedAt: true },
        },
      },
    })

    if (!user) {
      res.status(404).json({ code: 4004, message: '用户不存在', data: null })
      return
    }

    // 计算剩余秒数
    const now = Date.now()
    const plots = user.plots.map((p: { plotId: number; status: string; crop: string | null; plantedAt: Date | null }) => {
      let remainingSeconds = 0
      if (p.status === 'growing' && p.plantedAt && p.crop) {
        const cropCfg = CROPS[p.crop as keyof typeof CROPS]
        if (cropCfg) {
          const totalMs = cropCfg.growDuration * 1000
          const elapsed = now - p.plantedAt.getTime()
          remainingSeconds = Math.max(0, Math.ceil((totalMs - elapsed) / 1000))
        }
      }
      const cropCfg = p.crop ? CROPS[p.crop as keyof typeof CROPS] : null
      return {
        plot_id: p.plotId,
        status: p.status,
        crop: p.crop,
        remaining_seconds: remainingSeconds,
        crop_name: cropCfg?.name ?? null,
        crop_emoji: cropCfg?.emoji ?? null,
      }
    })

    // 房产信息
    const { getHousingTier } = await import('../config/housing_matrix.js')
    const housing = getHousingTier(user.housingTier)

    res.json({
      code: 0,
      data: {
        user_id: user.userId,
        nickname: user.nickname || '匿名农夫',
        housing: {
          tier: housing.tier,
          name: housing.name,
          emoji: housing.emoji,
          badge: housing.badge,
          color: housing.color,
        },
        plots,
      },
    })
  } catch (err) {
    console.error('获取农场数据失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 获取收件箱 =====
// GET /api/social/mailbox
router.get('/mailbox', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const mails = await prisma.mailbox.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        senderId: true,
        content: true,
        offerItem: true,
        offerAmount: true,
        offerPrice: true,
        status: true,
        createdAt: true,
        sender: { select: { nickname: true } },
      },
    })

    res.json({
      code: 0,
      data: mails.map((m: any) => ({
        id: m.id,
        sender_id: m.senderId,
        sender_name: m.sender.nickname || '匿名',
        content: m.content,
        offer_item: m.offerItem,
        offer_amount: m.offerAmount,
        offer_price: m.offerPrice,
        status: m.status,
        created_at: Math.floor(m.createdAt.getTime() / 1000),
      })),
    })
  } catch (err) {
    console.error('获取收件箱失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 获取发件箱 =====
// GET /api/social/mailbox/sent
router.get('/mailbox/sent', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const mails = await prisma.mailbox.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        receiverId: true,
        content: true,
        offerItem: true,
        offerAmount: true,
        offerPrice: true,
        status: true,
        createdAt: true,
        receiver: { select: { nickname: true } },
      },
    })

    res.json({
      code: 0,
      data: mails.map((m: any) => ({
        id: m.id,
        receiver_id: m.receiverId,
        receiver_name: m.receiver.nickname || '匿名',
        content: m.content,
        offer_item: m.offerItem,
        offer_amount: m.offerAmount,
        offer_price: m.offerPrice,
        status: m.status,
        created_at: Math.floor(m.createdAt.getTime() / 1000),
      })),
    })
  } catch (err) {
    console.error('获取发件箱失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 获取未读邮件数量 =====
// GET /api/social/mailbox/unread-count
router.get('/mailbox/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const count = await prisma.mailbox.count({
      where: { receiverId: userId, status: 'unread' },
    })
    res.json({ code: 0, data: { count } })
  } catch (err) {
    console.error('获取未读计数失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 发送信件（含 OTC 担保交易预扣） =====
// POST /api/social/mailbox/send
// Body: { receiver_username, content, offer_item?, offer_amount?, offer_price? }
// 关键原则：offerPrice 在 DB 中代表"契约总金额"，send 时直接预扣 offerPrice
router.post('/mailbox/send', async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.userId!
    const { receiver_username, content, offer_item, offer_amount, offer_price } = req.body

    if (!receiver_username) {
      res.status(400).json({ code: 8001, message: '请指定收件人', data: null })
      return
    }

    // 查找收件人
    const receiver = await prisma.user.findUnique({
      where: { username: receiver_username },
      select: { userId: true },
    })

    if (!receiver) {
      res.status(404).json({ code: 4004, message: '收件人不存在', data: null })
      return
    }

    if (receiver.userId === senderId) {
      res.status(400).json({ code: 8002, message: '不能给自己发信', data: null })
      return
    }

    // 如果有 OTC 契约，在事务中预扣发件人金币
    if (offer_item && offer_amount && offer_price) {
      const totalPrice = Math.max(1, Math.floor(offer_price))

      await prisma.$transaction(async (tx: any) => {
        const sender = await tx.user.findUnique({
          where: { userId: senderId },
          select: { gold: true },
        })

        if (!sender || sender.gold < totalPrice) {
          throw new Error('金币不足，无法发起契约')
        }

        // 预扣金币（冻结在系统内）
        await tx.user.update({
          where: { userId: senderId },
          data: { gold: { decrement: totalPrice } },
        })

        // 创建信件（在事务内保证一致性）
        await tx.mailbox.create({
          data: {
            senderId,
            receiverId: receiver.userId,
            content: content || '',
            offerItem: offer_item,
            offerAmount: Math.max(1, Math.floor(offer_amount)),
            offerPrice: totalPrice,
            status: 'unread',
          },
        })
      })
    } else {
      // 纯文本信件，无需事务
      await prisma.mailbox.create({
        data: {
          senderId,
          receiverId: receiver.userId,
          content: content || '',
          offerItem: null,
          offerAmount: null,
          offerPrice: null,
          status: 'unread',
        },
      })
    }

    res.json({
      code: 0,
      message: '密函已投递',
      data: null,
    })
  } catch (err: any) {
    console.error('发送信件失败:', err)
    const msg = err?.message || '发送失败'
    res.status(400).json({ code: 8003, message: msg, data: null })
  }
})

// ===== 标记为已读 =====
// POST /api/social/mailbox/:id/read
router.post('/mailbox/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const id = parseInt(req.params.id as string)

    const mail = await prisma.mailbox.findUnique({ where: { id } })
    if (!mail || mail.receiverId !== userId) {
      res.status(404).json({ code: 4004, message: '信件不存在', data: null })
      return
    }

    if (mail.status === 'unread') {
      await prisma.mailbox.update({ where: { id }, data: { status: 'read' } })
    }

    res.json({ code: 0, message: '已标记为已读' })
  } catch (err) {
    console.error('标记已读失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

// ===== 接受 OTC 契约（原子交割） =====
// POST /api/social/mailbox/:id/accept
// 关键原则：Send 已预扣发件人金币，此处只做：
//   1. 校验收件人库存
//   2. 扣除收件人物品，增加给发件人
//   3. 将 offerPrice（预扣款）释放给收件人
//   4. 标记 accepted
// 绝不对发件人二次扣款！
router.post('/mailbox/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const id = parseInt(req.params.id as string)

    const mail = await prisma.mailbox.findUnique({ where: { id } })
    if (!mail || mail.receiverId !== userId) {
      res.status(404).json({ code: 4004, message: '信件不存在', data: null })
      return
    }

    if (mail.status !== 'unread' && mail.status !== 'read') {
      res.status(400).json({ code: 8004, message: '该契约已被处理', data: null })
      return
    }

    if (!mail.offerItem || !mail.offerAmount || !mail.offerPrice) {
      res.status(400).json({ code: 8005, message: '该信件不包含可执行的契约', data: null })
      return
    }

    // 非空断言（已在上面校验过）
    const offerItem = mail.offerItem
    const offerAmount = mail.offerAmount
    const offerPrice = mail.offerPrice

    // 原子事务交割
    await prisma.$transaction(async (tx: any) => {
      // 1. 校验收件人库存
      const receiverInv = await tx.inventory.findUnique({
        where: { userId_item: { userId: mail.receiverId, item: offerItem } },
      })
      if (!receiverInv || receiverInv.amount < offerAmount) {
        throw new Error('你的库存不足，无法成交')
      }

      // 2. 金币流转：将预扣的 offerPrice 释放给收件人（发件人已在 Send 时被扣）
      await tx.user.update({
        where: { userId: mail.receiverId },
        data: { gold: { increment: offerPrice } },
      })

      // 3. 库存流转：收件人 -> 发件人
      await tx.inventory.update({
        where: { userId_item: { userId: mail.receiverId, item: offerItem } },
        data: { amount: { decrement: offerAmount } },
      })
      await tx.inventory.update({
        where: { userId_item: { userId: mail.senderId, item: offerItem } },
        data: { amount: { increment: offerAmount } },
      })

      // 4. 标记契约成交
      await tx.mailbox.update({
        where: { id },
        data: { status: 'accepted' },
      })
    })

    res.json({ code: 0, message: '🎉 契约成交！钱货两清' })
  } catch (err: any) {
    console.error('接受契约失败:', err)
    const msg = err?.message || '交割失败'
    res.status(400).json({ code: 8006, message: msg, data: null })
  }
})

// ===== 拒绝 OTC 契约（退还预扣款） =====
// POST /api/social/mailbox/:id/decline
// 关键原则：将 Send 时预扣的 offerPrice 全额退还给发件人
router.post('/mailbox/:id/decline', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const id = parseInt(req.params.id as string)

    const mail = await prisma.mailbox.findUnique({ where: { id } })
    if (!mail || mail.receiverId !== userId) {
      res.status(404).json({ code: 4004, message: '信件不存在', data: null })
      return
    }

    if (mail.status !== 'unread' && mail.status !== 'read') {
      res.status(400).json({ code: 8004, message: '该契约已被处理', data: null })
      return
    }

    // 原子退还：退还预扣款 + 标记拒绝
    await prisma.$transaction(async (tx: any) => {
      // 退还发件人预扣金币
      if (mail.offerPrice && mail.offerPrice > 0) {
        await tx.user.update({
          where: { userId: mail.senderId },
          data: { gold: { increment: mail.offerPrice } },
        })
      }

      await tx.mailbox.update({
        where: { id },
        data: { status: 'declined' },
      })
    })

    res.json({ code: 0, message: '已拒绝该契约' })
  } catch (err) {
    console.error('拒绝契约失败:', err)
    res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
  }
})

export default router
