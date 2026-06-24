/**
 * 种子数据脚本
 * 运行：npx tsx src/seed.ts
 */
import prisma from './prisma.js'
import { COMPANIES } from './config/companies.js'
import { CROPS, CROP_IDS, getCropsByCategory } from './config/crops.js'
import { initPrices } from './services/priceEngine.js'

async function main() {
  console.log('🌱 开始播种数据...')

  // 清空旧数据
  await prisma.marketEvent.deleteMany()
  await prisma.marketEnvironment.deleteMany()
  await prisma.marketOrder.deleteMany()
  await prisma.cow.deleteMany()
  await prisma.plot.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.user.deleteMany()

  // 创建玩家（seed 专用密码：统一为 'seed1234'）
  const seedPasswordHash =
    '$2a$10$dummyhashforseedonly123456789abcdefghijklmnopqrstuvwxyz'
  const users = await Promise.all([
    prisma.user.create({
      data: { username: '青羽', passwordHash: seedPasswordHash, nickname: '青羽', gold: 100 },
    }),
    prisma.user.create({
      data: { username: '农民小王', passwordHash: seedPasswordHash, nickname: '农民小王', gold: 50 },
    }),
    prisma.user.create({
      data: { username: '商人大李', passwordHash: seedPasswordHash, nickname: '商人大李', gold: 200 },
    }),
  ])

  // 初始化库存（所有 40 种作物 + 通用种子）
  const inventoryData: { userId: number; item: string; amount: number }[] = []

  // 🔴 V1.0.1: 种子按作物区分 — seed_{cropId}
  // 玩家1（青羽）：少量种子，无库存
  inventoryData.push({ userId: users[0].userId, item: 'seed_wheat', amount: 20 })
  for (const cropId of CROP_IDS) {
    inventoryData.push({ userId: users[0].userId, item: cropId, amount: 0 })
  }

  // 玩家2（农民小王）：有部分收成
  inventoryData.push({ userId: users[1].userId, item: 'seed_wheat', amount: 10 })
  for (const cropId of CROP_IDS) {
    const amount = Math.random() < 0.3 ? Math.floor(Math.random() * 10) + 1 : 0
    inventoryData.push({ userId: users[1].userId, item: cropId, amount })
  }

  // 玩家3（商人大李）：有较多库存用于挂单
  inventoryData.push({ userId: users[2].userId, item: 'seed_wheat', amount: 5 })
  for (const cropId of CROP_IDS) {
    const amount = Math.random() < 0.4 ? Math.floor(Math.random() * 15) + 2 : 0
    inventoryData.push({ userId: users[2].userId, item: cropId, amount })
  }

  await prisma.inventory.createMany({ data: inventoryData })

  // 初始化土地（每人 12 块：前 6 块 idle，后 6 块 locked）
  const plotData = users.flatMap((u) =>
    Array.from({ length: 12 }, (_, i) => ({
      plotId: i + 1,
      userId: u.userId,
      status: i < 6 ? 'idle' : 'locked',
    }))
  )
  await prisma.plot.createMany({ data: plotData })

  // 初始化企业收购价
  await initPrices()

  // 创建示例挂单（覆盖多个分类的作物）
  const sampleOrders = [
    // 谷物类
    { sellerId: users[1].userId, item: 'corn', amount: 5, totalPrice: 8 },
    { sellerId: users[1].userId, item: 'wheat', amount: 10, totalPrice: 15 },
    { sellerId: users[2].userId, item: 'rice', amount: 8, totalPrice: 20 },
    { sellerId: users[2].userId, item: 'barley', amount: 6, totalPrice: 18 },
    // 蔬菜类
    { sellerId: users[1].userId, item: 'cabbage', amount: 12, totalPrice: 10 },
    { sellerId: users[2].userId, item: 'tomato', amount: 8, totalPrice: 16 },
    // 水果类
    { sellerId: users[2].userId, item: 'apple', amount: 5, totalPrice: 20 },
    // 经济作物
    { sellerId: users[1].userId, item: 'cotton', amount: 3, totalPrice: 18 },
    // 珍稀草药
    { sellerId: users[2].userId, item: 'aloe', amount: 4, totalPrice: 28 },
  ]

  for (const order of sampleOrders) {
    await prisma.marketOrder.create({ data: order })
  }

  console.log('✅ 数据播种完成！')
  console.log(`   👤 玩家: ${users.length} 人`)
  console.log(`   🏞️  土地: ${plotData.length} 块 (6 idle + 6 locked)`)
  console.log(`   🌾 作物种类: ${CROP_IDS.length} 种`)
  console.log(`   🏢 企业收购价: ${Object.keys(COMPANIES).length} 家`)
  console.log(`   📦 示例挂单: ${sampleOrders.length} 条`)
  console.log(`   📋 库存记录: ${inventoryData.length} 条`)
}

main()
  .catch((e) => {
    console.error('❌ 播种失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
