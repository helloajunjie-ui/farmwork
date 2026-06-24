/**
 * 无感鉴权路由 — MVP 5.0
 *
 * 设计哲学：
 *   "名字+密码就是身份" — 不区分注册/登录，一个接口完成。
 *   若用户不存在 → 自动创建（新大户入场）
 *   若用户存在 → 校验密码（老玩家回归）
 *
 * 安全底线：
 *   - bcrypt 单向哈希，绝不存明文
 *   - JWT 无状态鉴权，零数据库查询验证
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prisma.js'
import { CROP_IDS } from '../config/economy_matrix.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'cyber-farm-secret-key-2024'
const JWT_EXPIRES_IN = '7d' // Token 有效期 7 天

// POST /api/auth/login — 自动注册/登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  // 参数校验
  if (!username || !password) {
    res.status(400).json({ code: 4003, message: '请输入代号和密钥', data: null })
    return
  }

  if (typeof username !== 'string' || username.length < 1 || username.length > 32) {
    res.status(400).json({ code: 4004, message: '代号长度需在 1~32 字符之间', data: null })
    return
  }

  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ code: 4005, message: '密钥长度不能少于 6 位', data: null })
    return
  }

  // 查找用户
  let user = await prisma.user.findUnique({ where: { username } })

  if (!user) {
    // ===== MVP 5.1: 新大户入场（新手破冰版）=====
    // 初始资本：500 金币 + 30 颗小麦种子（3分钟极速作物）
    const passwordHash = await bcrypt.hash(password, 10)

    user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          username,
          passwordHash,
          nickname: username,
          gold: 500, // MVP 5.1: 从 100 → 500
        },
      })

      // 🔴 V1.0.1: 初始化库存 — 所有作物默认为 0，但 wheat 直接给 30 颗
      const inventoryData = CROP_IDS.map((item) => ({
        userId: newUser.userId,
        item,
        amount: item === 'wheat' ? 30 : 0, // 新手赠送 30 颗小麦（10分钟极速作物）
      }))
      // 🔴 V1.0.1: 种子按作物区分 — 新手赠送 30 颗小麦种子
      inventoryData.push({ userId: newUser.userId, item: 'seed_wheat', amount: 30 })

      await tx.inventory.createMany({ data: inventoryData })

      // 初始化 12 块土地：前 6 块空闲，后 6 块锁定
      const plotData = Array.from({ length: 12 }, (_, i) => ({
        plotId: i + 1,
        userId: newUser.userId,
        status: i < 6 ? 'idle' : 'locked',
      }))
      await tx.plot.createMany({ data: plotData })

      return newUser
    })
  } else {
    // ===== 老玩家回归：校验密码 =====
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ code: 4006, message: '密码错误或该代号已被注册', data: null })
      return
    }

    // 🔴 V1.0.1: 破产救济金 — 检测破产状态并自动发放
    const existingUser = user // 此时 user 一定不为 null
    if (existingUser.isBankrupt && existingUser.gold <= 0) {
      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { userId: existingUser.userId },
          data: {
            gold: 50,
            isBankrupt: false,
          },
        })
        // 发放 10 颗小麦种子作为救济
        await tx.inventory.upsert({
          where: { userId_item: { userId: existingUser.userId, item: 'seed_wheat' } },
          create: { userId: existingUser.userId, item: 'seed_wheat', amount: 10 },
          update: { amount: { increment: 10 } },
        })
      })
      console.log(`[救济] 玩家 ${existingUser.username} 已自动领取破产救济金`)
    }
  }

  // 此时 user 一定不为 null（if 分支创建了新用户，else 分支校验通过后继续）
  if (!user) return

  // 签发 JWT
  const token = jwt.sign(
    { userId: user.userId, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )

  res.json({
    code: 0,
    message: '接入网络成功',
    data: {
      token,
      user: {
        user_id: user.userId,
        username: user.username,
        nickname: user.nickname,
      },
    },
  })
})

export default router
