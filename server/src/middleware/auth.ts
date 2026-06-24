/**
 * JWT 鉴权中间件 — MVP 5.0
 *
 * 设计原则：
 * - 无状态鉴权，零数据库查询开销
 * - 从 Authorization: Bearer <token> 解析 userId
 * - 将 userId 挂载到 req 上下文中供下游路由使用
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'cyber-farm-secret-key-2024'

export interface AuthRequest extends Request {
  userId?: number
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // 白名单：无需鉴权的路由
  const publicPaths = ['/api/auth/login', '/api/health']
  if (publicPaths.some((p) => req.path === p || req.path.startsWith(p))) {
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 4001, message: '未提供访问凭证', data: null })
    return
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string }
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ code: 4002, message: '凭证已过期或无效，请重新登录', data: null })
  }
}
