import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/user.js'
import farmRoutes from './routes/farm.js'
import marketRoutes from './routes/market.js'
import leaderboardRoutes from './routes/leaderboard.js'
import socialRoutes from './routes/social.js'
import mailboxRoutes from './routes/mailbox.js'
import { initPrices, initSeedPrices, startPriceEngine } from './services/priceEngine.js'

const app = express()
const PORT = process.env.PORT || 3000

// 中间件
app.use(cors())
app.use(express.json())

// 请求日志（开发用）
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
  next()
})

// JWT 鉴权（白名单路由放行 /api/auth/login, /api/health）
app.use(authMiddleware)

// 路由挂载
app.use('/api/auth', authRoutes)
app.use('/api/user', userRoutes)
app.use('/api/farm', farmRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/social', mailboxRoutes)

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: '🌾 赛博农场后端引擎运行中', data: null })
})

// 全局错误处理
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('未捕获错误:', err)
  res.status(500).json({ code: 9999, message: '服务器内部错误', data: null })
})

app.listen(PORT, async () => {
  // 初始化价格引擎
  await initPrices()
  await initSeedPrices()
  startPriceEngine()

  console.log(`\n🌾 赛博农场后端引擎已启动`)
  console.log(`   📡 http://localhost:${PORT}`)
  console.log(`   🔐 /api/auth/login`)
  console.log(`   ❤️  /api/health`)
  console.log(`   👤  /api/user/info`)
  console.log(`   🏞️  /api/farm/plots`)
  console.log(`   🌱  /api/farm/plant`)
  console.log(`   🔪  /api/farm/harvest`)
  console.log(`   🏪  /api/market/orders`)
  console.log(`   📦  /api/market/sell`)
  console.log(`   🤝  /api/market/buy`)
  console.log(`   🏢  /api/market/companies`)
  console.log(`   💼  /api/market/sell-to-company`)
  console.log(`   🏆  /api/leaderboard`)
  console.log(`   🆔  /api/social/profile/:username`)
  console.log(`   🏠  /api/social/upgrade-house`)
  console.log(`   📬  /api/social/mailbox`)
  console.log(`   🏙️  /api/social/farm/:username`)
  console.log(`   📜  /api/social/mailbox/send`)
  console.log(`   🤝  /api/social/mailbox/:id/accept\n`)
})
