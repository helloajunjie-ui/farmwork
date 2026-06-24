# 数据库设计文档 (SQLite)

> **引擎**: SQLite 3  
> **ORM**: Prisma  
> **事务隔离级别**: `SERIALIZABLE` (SQLite 默认)

---

## 核心设计原则

1. **服务器时间为唯一真理** — 所有生长/成熟判定基于 `DateTime.now()`，不信任客户端时间
2. **ACID 事务保证资产安全** — 库存扣减、金币转移必须在事务中完成
3. **O(1) 离线结算** — 打工牛 + 地租均使用时间差公式，零 cron 开销
4. **预留扩展字段** — `avatar_url` 初期为 `NULL`，后期无缝接入
5. **JWT 无状态认证** — 密码使用 bcrypt 哈希，不存储明文

---

## Prisma Schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  userId       Int       @id @default(autoincrement()) @map("user_id")
  nickname     String    @default("")
  passwordHash String    @map("password_hash")
  gold         Int       @default(100)
  avatarUrl    String?   @map("avatar_url")
  upkeepRate   Float     @default(0) @map("upkeep_rate")
  lastUpkeepAt DateTime  @default(now()) @map("last_upkeep_at")
  isBankrupt   Boolean   @default(false) @map("is_bankrupt")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  inventory Inventory[]
  plots     Plot[]
  cow       Cow?
  sellOrders MarketOrder[] @relation("seller")

  @@map("users")
}

model Inventory {
  userId Int    @map("user_id")
  item   String
  amount Int    @default(0)

  user User @relation(fields: [userId], references: [userId])

  @@id([userId, item])
  @@map("inventory")
}

model Plot {
  plotId         Int       @map("plot_id")
  userId         Int       @map("user_id")
  status         String    @default("idle") // locked | idle | growing | ready
  plantedAt      DateTime? @map("planted_at")
  crop           String?
  unlockPrice    Int?      @map("unlock_price")

  user User @relation(fields: [userId], references: [userId])

  @@id([plotId, userId])
  @@map("plots")
}

model Cow {
  userId      Int      @id @map("user_id")
  active      Boolean  @default(true)
  lastSyncAt  DateTime @default(now()) @map("last_sync_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [userId])

  @@map("cows")
}

model MarketOrder {
  id         Int      @id @default(autoincrement())
  sellerId   Int      @map("seller_id")
  item       String
  amount     Int
  unitPrice  Int      @map("unit_price")
  totalPrice Int      @map("total_price")
  status     String   @default("active") // active | sold | cancelled
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  seller User @relation("seller", fields: [sellerId], references: [userId])

  @@index([status])
  @@index([sellerId])
  @@index([item, unitPrice])
  @@map("market_orders")
}

model MarketEnvironment {
  cropId            String   @id @map("crop_id")
  buyPrice          Int      @map("buy_price")
  seedTargetPrice   Int      @map("seed_target_price")
  updatedAt         DateTime @default(now()) @map("updated_at")

  @@map("market_environment")
}

model MarketEvent {
  id             Int      @id @default(autoincrement())
  cropId         String   @map("crop_id")
  eventType      String   @map("event_type")   // drought | festival | scandal
  title          String
  description    String?
  priceModifier  Float    @map("price_modifier") // ±0.3 = ±30%
  expiresAt      DateTime @map("expires_at")
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([cropId])
  @@index([expiresAt])
  @@map("market_events")
}
```

---

## 表结构说明

### 1. `users` — 玩家表

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `Int @id @default(autoincrement())` | 主键，自增 |
| `nickname` | `String @default("")` | 昵称 |
| `password_hash` | `String` | bcrypt 哈希密码 |
| `gold` | `Int @default(100)` | 金币，不可为负数 |
| `avatar_url` | `String?` | 预留：头像 URL |
| `upkeep_rate` | `Float @default(0)` | 地租费率 (🪙/min) |
| `last_upkeep_at` | `DateTime @default(now())` | 上次地租结算时间 |
| `is_bankrupt` | `Boolean @default(false)` | 是否破产 |
| `created_at` | `DateTime @default(now())` | 创建时间 |
| `updated_at` | `DateTime @updatedAt` | 更新时间 |

### 2. `inventory` — 物品库存表

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `Int` | 外键 → users |
| `item` | `String` | 物品标识符，如 'corn', 'seed', 'wheat', 'hops' |
| `amount` | `Int @default(0)` | 持有数量，不可为负数 |

> **联合主键**: `(user_id, item)`  
> **为什么不用 JSON 字段存所有物品？** 关系型设计便于后续扩展（物品类型增加、查询排序、事务锁定粒度更细）。

### 3. `plots` — 土地表

| 字段 | 类型 | 说明 |
|------|------|------|
| `plot_id` | `Int` | 土地编号 (1~N) |
| `user_id` | `Int` | 外键 → users |
| `status` | `String @default("idle")` | locked=锁定 idle=空闲 growing=生长中 ready=已成熟 |
| `planted_at` | `DateTime?` | 播种时的服务器时间戳，NULL=空闲 |
| `crop` | `String?` | 作物类型：'wheat', 'corn', 'hops' |
| `unlock_price` | `Int?` | 解锁所需金币，locked 时有效 |

> **联合主键**: `(plot_id, user_id)`  
> **生长周期**：
> - 🌾 小麦: 600 秒 (10 min)
> - 🌽 玉米: 1680 秒 (28 min)
> - 🍺 啤酒花: 3600 秒 (60 min)

### 4. `cows` — 打工牛表

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `Int @id` | 主键，外键 → users |
| `active` | `Boolean @default(true)` | 是否活跃 |
| `last_sync_at` | `DateTime @default(now())` | 上次同步时间戳 |
| `created_at` | `DateTime @default(now())` | 创建时间 |
| `updated_at` | `DateTime @updatedAt` | 更新时间 |

> **O(1) 离线结算公式**：
> ```
> elapsed = NOW() - last_sync_at
> cycles  = floor(elapsed / GROW_DURATION)
> actual  = min(cycles, floor(available_seeds / planted_plots_count))
> ```

### 5. `market_orders` — 市场订单表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `Int @id @default(autoincrement())` | 主键，自增 |
| `seller_id` | `Int` | 外键 → users |
| `item` | `String` | 物品标识符 |
| `amount` | `Int` | 数量 (>0) |
| `unit_price` | `Int` | 单价（金币/个） |
| `total_price` | `Int` | 总价 = amount × unit_price |
| `status` | `String @default("active")` | active=挂单中 sold=已售出 cancelled=已取消 |
| `created_at` | `DateTime @default(now())` | 创建时间 |
| `updated_at` | `DateTime @updatedAt` | 更新时间 |

### 6. `market_environment` — 宏观环境表

| 字段 | 类型 | 说明 |
|------|------|------|
| `crop_id` | `String @id` | 主键，作物标识符 |
| `buy_price` | `Int` | 当前企业收购价（动态波动） |
| `seed_target_price` | `Int` | 种子目标价（相位延迟用） |
| `updated_at` | `DateTime @default(now())` | 更新时间 |

### 7. `market_events` — 宏观事件表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `Int @id @default(autoincrement())` | 主键，自增 |
| `crop_id` | `String` | 影响的作物 |
| `event_type` | `String` | 事件类型：drought / festival / scandal |
| `title` | `String` | 事件标题 |
| `description` | `String?` | 事件描述 |
| `price_modifier` | `Float` | 价格修正系数，1.3 = +30%, 0.7 = -30% |
| `expires_at` | `DateTime` | 事件过期时间 |
| `created_at` | `DateTime @default(now())` | 创建时间 |

---

## 初始化数据

```typescript
// seed.ts — 测试账号
// 用户名: demo / 密码: demo123  →  金币: 500, 库存: 30 wheat + 30 seed
// 用户名: admin / 密码: admin123 →  金币: 999999, 全品类库存

// 每个用户 12 块地：前 6 块空闲，后 6 块锁定
// 解锁价格：7→100, 8→500, 9→2000, 10→8000, 11→32000, 12→128000

// 宏观环境初始化
// wheat: buy=3, seed_target=2
// corn:  buy=6, seed_target=4
// hops:  buy=15, seed_target=10
```

---

## 关键事务逻辑

### 播种事务

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 校验土地是否空闲
  const plot = await tx.plot.findUnique({
    where: { plotId_userId: { plotId, userId } }
  })
  if (plot?.status !== 'idle') throw new AppError(1001, '土地不空闲')

  // 2. 扣减种子
  const inv = await tx.inventory.findUnique({
    where: { userId_item: { userId, item: 'seed' } }
  })
  if (!inv || inv.amount < 1) throw new AppError(1002, '种子不足')

  await tx.inventory.update({
    where: { userId_item: { userId, item: 'seed' } },
    data: { amount: { decrement: 1 } }
  })

  // 3. 更新土地状态
  await tx.plot.update({
    where: { plotId_userId: { plotId, userId } },
    data: { status: 'growing', crop, plantedAt: new Date() }
  })
})
```

### 收割事务

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 校验土地状态
  const plot = await tx.plot.findUnique({
    where: { plotId_userId: { plotId, userId } }
  })
  if (!plot?.plantedAt) throw new AppError(1101, '未播种')
  
  const elapsed = (Date.now() - plot.plantedAt.getTime()) / 1000
  const growDuration = CROPS[plot.crop!]?.growDuration
  if (elapsed < growDuration) throw new AppError(1102, '尚未成熟')

  // 2. 增加作物库存（固定收获 3 个）
  await tx.inventory.upsert({
    where: { userId_item: { userId, item: plot.crop! } },
    update: { amount: { increment: 3 } },
    create: { userId, item: plot.crop!, amount: 3 }
  })

  // 3. 重置土地
  await tx.plot.update({
    where: { plotId_userId: { plotId, userId } },
    data: { status: 'idle', plantedAt: null, crop: null }
  })
})
```

### 解锁土地事务

```typescript
await prisma.$transaction(async (tx) => {
  const plot = await tx.plot.findUnique({
    where: { plotId_userId: { plotId, userId } }
  })
  if (plot?.status !== 'locked') throw new AppError(1201, '土地未锁定')
  if (!plot.unlockPrice) throw new AppError(1202, '解锁价格无效')

  const user = await tx.user.findUnique({ where: { userId } })
  if (!user || user.gold < plot.unlockPrice) throw new AppError(1203, '金币不足')

  await tx.user.update({
    where: { userId },
    data: { gold: { decrement: plot.unlockPrice } }
  })
  await tx.plot.update({
    where: { plotId_userId: { plotId, userId } },
    data: { status: 'idle', unlockPrice: null }
  })
})
```

### 市场购买事务（防并发）

```typescript
await prisma.$transaction(async (tx) => {
  // 1. 锁定订单（SQLite 串行化事务天然防并发）
  const order = await tx.marketOrder.findUnique({
    where: { id: orderId }
  })
  if (order?.status !== 'active') throw new AppError(2101, '订单已失效')
  if (order.sellerId === userId) throw new AppError(2102, '不能购买自己的订单')

  const buyer = await tx.user.findUnique({ where: { userId } })
  if (!buyer || buyer.gold < order.totalPrice) throw new AppError(2103, '金币不足')

  // 2. 扣买家金币
  await tx.user.update({
    where: { userId },
    data: { gold: { decrement: order.totalPrice } }
  })

  // 3. 加卖家金币
  await tx.user.update({
    where: { userId: order.sellerId },
    data: { gold: { increment: order.totalPrice } }
  })

  // 4. 给买家加物品
  await tx.inventory.upsert({
    where: { userId_item: { userId, item: order.item } },
    update: { amount: { increment: order.amount } },
    create: { userId, item: order.item, amount: order.amount }
  })

  // 5. 更新订单状态
  await tx.marketOrder.update({
    where: { id: orderId },
    data: { status: 'sold' }
  })
})
```

### 地租结算 (MVP 4.0)

```typescript
// 计算地租费率
// rate = (unlocked_plots - 10)² × 0.5, 当 unlocked_plots > 10 时

// 时间差结算
const elapsedMinutes = Math.min(60, (now.getTime() - user.lastUpkeepAt.getTime()) / 60000)
const totalUpkeep = Math.ceil(elapsedMinutes * user.upkeepRate)

// 扣减金币
await tx.user.update({
  where: { userId },
  data: {
    gold: { decrement: Math.min(totalUpkeep, user.gold) },
    lastUpkeepAt: now
  }
})

// 如果 gold < totalUpkeep，触发清算：
// 从最大 plot_id 开始锁定土地，每块返还 5 金币
// 直到 gold >= 0
```

---

## 与 PostgreSQL 版本的差异

| 项目 | PostgreSQL | SQLite (当前) |
|------|-----------|---------------|
| 引擎 | PostgreSQL 14+ | SQLite 3 |
| 自增 | `SERIAL` | `@default(autoincrement())` |
| 时间戳 | `TIMESTAMPTZ` | `DateTime` |
| 行级锁 | `SELECT ... FOR UPDATE` | 串行化事务（无需显式锁） |
| 约束 | `CHECK (gold >= 0)` | 应用层校验 |
| 部署 | 需独立数据库服务 | 零配置，文件数据库 |
| 认证 | 无 | JWT + bcrypt |
| 头像 | 无 | `avatar_url` 预留字段 |
