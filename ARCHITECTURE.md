# 🏡 赛博农场 — 架构总览

> **版本**: MVP 8.1 (双重计价 & 场外暗池 & 豪宅矩阵)  
> **哲学**: 文字先行 · 轻量高效 · 反通胀经济 · 周期博弈 · 社交黑暗森林

---

## 一、系统分层

```
┌─────────────────────────────────────────────┐
│            Presentation Layer                │
│   Vue 3 SPA (Vite + Pinia + TailwindCSS)    │
│   Text-First UI · 纯静态 · 可部署 Vercel     │
│   移动端: Bottom Sheet + TabBar              │
│   PC端: 居中模态框 + Header                  │
│   玻璃态名片 · 火漆信封 · 冷色调窥探滤镜      │
├─────────────────────────────────────────────┤
│            Business Gateway Layer            │
│   Express + TypeScript · RESTful API         │
│   Server Time = 唯一真理 · ACID 事务         │
│   价格波动引擎 · 地租结算中间件               │
│   JWT 鉴权 · 排行榜引擎 · 信箱 OTC 原子交割  │
│   房产升级 · 公开名片 API                    │
├─────────────────────────────────────────────┤
│            Persistence Layer                 │
│   SQLite · Prisma ORM                        │
│   行级锁 FOR UPDATE · 时间差 O(1) 离线结算   │
│   8 表: users, inventory, plots, cows,       │
│   market_orders, market_environment,         │
│   market_events, mailbox                     │
└─────────────────────────────────────────────┘
```

### 核心原则

| 原则 | 说明 |
|------|------|
| **服务器时间为唯一真理** | 所有生长/成熟判定基于服务器时间戳，绝不信任客户端 |
| **ACID 事务** | 所有资产变更（播种/收割/挂单/购买/解锁/OTC 交割）在事务中完成 |
| **行级锁防并发** | 市场购买使用 `SELECT ... FOR UPDATE` 锁定订单行 |
| **O(1) 离线结算** | 打工牛 + 地租均使用时间差公式，零 cron 开销 |
| **指数级金币回收** | 土地解锁成本指数递增 + 地租指数递增 + 豪宅指数递增，对抗通胀 |
| **蛛网经济模型** | 种子价格滞后于收购价 ~5 分钟，创造套利窗口 |
| **双轨制排行榜** | 农夫新星榜(≤6块地) vs 资本巨鳄榜(>6块地)，动态净值计算 |
| **全局单位格式化** | 所有数字必须带 🪙/吨 单位，杜绝光秃秃的数字 |
| **原子化 OTC 交割** | 信箱暗池交易在 Prisma `$transaction` 中完成，保证资产安全 |
| **双重计价** | 房产同时展示游戏金币成本 + 现实 RMB 估值，心理锚点强化 |

---

## 二、数据流

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │  Farm    │    │  Market  │    │ Leaderboard  │    │  Mailbox │    │  Social  │
│  Store   │    │  Store   │    │  Store   │    │   Store      │    │  Store   │    │  (内联)  │
├──────────┤    ├──────────┤    ├──────────┤    ├──────────────┤    ├──────────┤    ├──────────┤
│ gold     │    │ plots[]  │    │ depth[]  │    │ farmers[]    │    │ inbox[]  │    │ profile  │
│ items    │    │ cowStatus│    │ myOrders │    │ capitalists[]│    │ sent[]   │    │ housing  │
│ upkeep   │    │ loading  │    │ loading  │    │ loading      │    │ unread   │    │ readonly │
│ health%  │    └────┬─────┘    └────┬─────┘    └──────┬───────┘    │ polling  │    │ farm     │
│ housing  │         │               │               │            └────┬──────┘    └──────────┘
└────┬─────┘         │               │               │                │
     │               └───────────────┼───────────────┘────────────────┘
     │                               │
     ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       API Layer                                  │
│                  (Axios / Mock 双模式)                            │
└──────────────────────────────┬───────────────────────────────────┘
                              │ HTTP / Mock
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                Express API (RESTful)                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │  routes/  │ │services/ │ │ middleware/  │ │  config/        │ │
│  │ auth.ts   │ │priceEng. │ │ auth.ts      │ │ crops.ts        │ │
│  │ farm.ts   │ │          │ │ upkeep.ts    │ │ companies.ts    │ │
│  │ market.ts │ └──────────┘ └──────────────┘ │ economy_matrix  │ │
│  │ user.ts   │                               │ housing_matrix  │ │
│  │ leaderboard.ts                            └─────────────────┘ │
│  │ social.ts    ← MVP 7.0: 名片 + 房产升级                       │
│  │ mailbox.ts   ← MVP 8.0: 信箱 + OTC 暗池交易                   │
│  └──────────┘                                                     │
└──────────────────────────────┬───────────────────────────────────┘
                              │ Prisma
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SQLite                                      │
│  8 tables: users, inventory, plots, cows, market_orders,         │
│  market_environment, market_events, mailbox                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型 (8 表)

| 表 | 用途 | 关键字段 |
|----|------|----------|
| [`users`](server/prisma/schema.prisma) | 玩家 | `gold` (CHECK ≥ 0), `upkeep_rate`, `last_upkeep_at`, `is_bankrupt`, `housing_tier` (MVP 7.0) |
| [`inventory`](server/prisma/schema.prisma) | 物品库存 | 复合主键 `(user_id, item)` |
| [`plots`](server/prisma/schema.prisma) | 土地 | `status` (locked/idle/growing/ready), `unlock_price` |
| [`cows`](server/prisma/schema.prisma) | 打工牛 | `active`, `last_sync_at` (O(1) 离线结算) |
| [`market_orders`](server/prisma/schema.prisma) | 市场订单 | `status` (active/sold/cancelled), `unit_price` |
| [`market_environment`](server/prisma/schema.prisma) | 宏观环境 | `crop_id`, `buy_price`, `seed_target_price`, `updated_at` |
| [`market_events`](server/prisma/schema.prisma) | 宏观事件 | `crop_id`, `event_type`, `title`, `price_modifier`, `expires_at` |
| [`mailbox`](server/prisma/schema.prisma) | 信箱 (MVP 8.0) | `sender_id`, `receiver_id`, `content`, `offer_item/amount/price`, `status` (unread/read/accepted/declined) |

---

## 四、API 清单 (~25 个端点)

| 方法 | 路径 | 说明 | 事务 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录/注册（JWT） | ✅ |
| GET | `/api/user/info` | 玩家信息 + 库存 + 地租健康度 + 房产等级 | - |
| GET | `/api/farm/plots` | 所有土地状态 + 打工牛离线结算 + 地租结算 | - |
| POST | `/api/farm/plant` | 播种 | ✅ |
| POST | `/api/farm/harvest` | 收割 | ✅ |
| POST | `/api/farm/unlock` | 解锁土地 | ✅ |
| POST | `/api/farm/buy-cow` | 购买打工牛 | ✅ |
| GET | `/api/farm/cow-status` | 打工牛状态 | - |
| POST | `/api/farm/buy-seed` | 批量购买种子（动态定价） | ✅ |
| GET | `/api/farm/seed-price` | 查询当前种子价格 | - |
| GET | `/api/market/orders` | 市场深度 + 我的挂单 | - |
| POST | `/api/market/sell` | 发布卖单（含 unit_price） | ✅ |
| POST | `/api/market/buy` | 购买（行级锁） | ✅ FOR UPDATE |
| GET | `/api/market/companies` | NPC 企业列表 + 收购价 | - |
| POST | `/api/market/sell-to-company` | 向 NPC 企业出售 | ✅ |
| GET | `/api/leaderboard` | 双轨制排行榜（农夫榜 + 资本榜） | - |
| **GET** | **`/api/social/profile/:username`** | **公开名片（MVP 7.0）** | **-** |
| **POST** | **`/api/social/upgrade-house`** | **房产升级（MVP 7.0）** | **✅** |
| **GET** | **`/api/social/farm/:username`** | **只读农场（MVP 8.0）** | **-** |
| **GET** | **`/api/social/mailbox`** | **收件箱（MVP 8.0）** | **-** |
| **GET** | **`/api/social/mailbox/sent`** | **发件箱（MVP 8.0）** | **-** |
| **GET** | **`/api/social/mailbox/unread-count`** | **未读数（MVP 8.0）** | **-** |
| **POST** | **`/api/social/mailbox/send`** | **发送密函（MVP 8.0）** | **✅ 预扣金币** |
| **POST** | **`/api/social/mailbox/:id/read`** | **标记已读（MVP 8.0）** | **-** |
| **POST** | **`/api/social/mailbox/:id/accept`** | **接受 OTC 合约（MVP 8.0）** | **✅ 原子交割** |
| **POST** | **`/api/social/mailbox/:id/decline`** | **拒绝 OTC 合约（MVP 8.0）** | **✅ 退款** |

---

## 五、经济系统

### 5.1 基础循环

```
播种(消耗1种子) → 等待(10~60min) → 收割(获得3作物) → 市场/企业卖出 → 赚金币
```

### 5.2 九种作物 (MVP 4.1)

| 品类 | 作物 | 生长周期 | 基础收购价 | 基础种子价 |
|------|------|----------|-----------|-----------|
| 🌾 谷物薯类 | 小麦 | 10 min | 3 🪙 | 2 🪙 |
| 🌾 谷物薯类 | 玉米 | 28 min | 6 🪙 | 4 🪙 |
| 🌾 谷物薯类 | 土豆 | 20 min | 5 🪙 | 3 🪙 |
| 🥬 日常蔬菜 | 番茄 | 15 min | 4 🪙 | 3 🪙 |
| 🥬 日常蔬菜 | 白菜 | 12 min | 3 🪙 | 2 🪙 |
| 🍎 水果类 | 苹果 | 45 min | 12 🪙 | 8 🪙 |
| 🍎 水果类 | 葡萄 | 60 min | 18 🪙 | 12 🪙 |
| 💰 经济作物 | 烟草 | 90 min | 30 🪙 | 20 🪙 |
| 🌿 珍稀草药 | 灵芝 | 120 min | 50 🪙 | 35 🪙 |

### 5.3 价格波动引擎

```
每 60 秒 tick 一次:
  1. 每个作物 buy_price += random(-1, 1) 微调
  2. 5% 概率触发宏观事件（±30% 价格波动）
  3. 更新 seed_target_price = baseSeedPrice + (buyPrice - baseBuyPrice) × 0.8
  4. 种子实际售价通过相位延迟公式逼近目标价（~5 分钟追上）
```

### 5.4 金币回收 (反通胀)

```
土地解锁 (指数递增):
  地块 7:   100 金币
  地块 8:   500 金币
  地块 9:   2,000 金币
  地块 10:  8,000 金币
  地块 11: 32,000 金币
  地块 12: 128,000 金币

打工牛: 5,000 金币 (一次性)
  → 离线自动播种/收割 (O(1) 时间差结算)

豪宅升级 (指数递增, MVP 7.0):
  cost = round(100 × 2.5^(tier-1) × (1 + tier × 0.1))
  Lv.1:    100 🪙
  Lv.5:    3,814 🪙
  Lv.10:   93,132 🪙
  Lv.15:   2,273,736 🪙
  Lv.20:   55,511,231 🪙
```

### 5.5 地租机制 (MVP 4.0)

```
地租费率 = (已解锁土地数 - 10)² × 0.5

  10 块地:  0 🪙/min  (免税)
  20 块地:  50 🪙/min
  30 块地:  200 🪙/min
  50 块地:  800 🪙/min

结算方式: 每次 API 请求时 O(1) 时间差结算
  → 最多扣除 60 分钟，防止离线过久被清空
```

### 5.6 破产清算 (MVP 4.0)

```
当金币不足以支付地租时:
  1. 从编号最大的土地开始锁定（法拍）
  2. 每块被锁定的土地返还 5 🪙 救济金
  3. 直到金币余额 ≥ 0
  4. 玩家标记 is_bankrupt = true
  5. 前端触发全屏清算动画
```

### 5.7 相位延迟种子定价 (MVP 4.0)

```
种子价格 ≠ 收购价，存在 ~5 分钟相位差:
  → 收购价上涨 → 种子价滞后上涨（套利窗口）
  → 收购价下跌 → 种子价滞后下跌（避险窗口）

公式:
  targetSeedPrice = baseSeedPrice + (currentBuyPrice - baseBuyPrice) × 0.8
  actualSeedPrice 每 tick 向 target 逼近 1/PHASE_LAG_STEPS
```

### 5.8 双轨制排行榜 (MVP 6.0)

```
动态净值公式:
  总净值 = 现金(金币) + (地块数 × 1000估值) + ∑(每种作物库存 × 该作物当前企业收购价)

阶级划分:
  👨‍🌾 农夫新星榜: 已解锁土地 ≤ 6 块
  🎩 资本巨鳄榜: 已解锁土地 > 6 块

排名: 按净值降序排列，各取前 50 名
```

### 5.9 20 阶豪宅矩阵 (MVP 7.0)

```
纯消耗型社交资产，无任何生产力加成。
唯一用途：社交炫耀 + 终极金币回收。

升级成本公式:
  cost = round(100 × 2.5^(tier-1) × (1 + tier × 0.1))
  totalCost = ∑cost (累计)

双重计价 (MVP 8.1):
  每个等级附带现实 RMB 估值（fiatValue），
  用于心理锚点，不影响游戏内经济。

等级一览:
  Lv.1  漏风茅草棚         100 🪙      ¥800/月 租金
  Lv.5  乡间小院          3,814 🪙    ¥200,000 RMB
  Lv.8  陆家嘴江景大平房  37,201 🪙    ¥18,000,000 RMB
  Lv.10 汤臣一品顶层复式  93,132 🪙    ¥118,000,000 RMB
  Lv.13 东郊壹号楼王      568,611 🪙   ¥315,000,000 RMB
  Lv.15 严家花园洋房      2,273,736 🪙 ¥1,000,000,000 RMB
  Lv.16 檀宫顶级庄园      3,558,594 🪙 ¥2,000,000,000 RMB
  Lv.20 近地轨道赛博庄园  55,511,231 🪙 ¥∞ 无法估量
```

### 5.10 场外暗池交易 — OTC 智能合约 (MVP 8.0)

```
信箱系统内嵌 OTC 合约，允许玩家私下议价交易。

发送流程:
  1. 发送方撰写密函 + 可选 OTC 合约（物品 + 数量 + 单价）
  2. 发送方金币被预扣（offerPrice × offerAmount）
  3. 接收方收到密函，可查看合约详情

接受流程 (原子化事务):
  1. 校验密函状态为 unread/read
  2. 校验接收方金币 ≥ 合约总价
  3. 扣接收方金币 → 加发送方金币（退回预扣）
  4. 转移物品库存
  5. 标记密函为 accepted

拒绝流程:
  1. 退回发送方预扣金币
  2. 标记密函为 declined
```

---

## 六、技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | Vue 3 (Composition API) | ^3.5 |
| 构建 | Vite | ^8 |
| 样式 | TailwindCSS | ^4 |
| 状态管理 | Pinia | ^2 |
| 路由 | Vue Router 4 | ^4 |
| HTTP | Axios | ^1 |
| 后端框架 | Express | ^4 |
| 运行时 | TypeScript (tsx) | ^5 |
| ORM | Prisma | ^6 |
| 数据库 | SQLite | - |
| 认证 | JWT (jsonwebtoken) | ^9 |

---

## 七、目录结构

```
nongchang/
├── ARCHITECTURE.md          # 本文档
├── README.md                # 项目 README
├── docs/
│   ├── api-contract.md      # API 契约文档
│   ├── database-ddl.md      # 数据库设计文档
│   └── frontend-architecture.md  # 前端架构文档
├── client/                  # Vue 3 前端
│   ├── src/
│   │   ├── api/             # API 层 (真实 + Mock)
│   │   ├── components/      # 通用组件
│   │   │   ├── AppHeader.vue          # PC 端顶栏
│   │   │   ├── AppFooter.vue          # 移动端 TabBar + 信箱入口
│   │   │   ├── GoldDisplay.vue        # 金币显示（formatGold）
│   │   │   ├── InventoryBadge.vue     # 库存徽章（formatAmountCompact）
│   │   │   ├── LeaderboardModal.vue   # 排行榜（PC模态框 + 移动端Bottom Sheet）
│   │   │   ├── ProfileCardModal.vue   # 玻璃态公开名片（MVP 7.0）
│   │   │   ├── ReadonlyFarmModal.vue  # 只读农场窥探（MVP 8.0）
│   │   │   ├── MailboxModal.vue       # 信箱（收件/发件）（MVP 8.0）
│   │   │   ├── MailComposeModal.vue   # 撰写密函 + OTC 合约（MVP 8.0）
│   │   │   ├── MailDetailModal.vue    # 密函详情 + 火漆信封（MVP 8.0）
│   │   │   └── SellModal.vue          # 卖单弹窗
│   │   ├── stores/          # Pinia 状态管理
│   │   │   ├── user.ts            # 玩家信息（含 housingTier）
│   │   │   ├── farm.ts            # 农场状态
│   │   │   ├── market.ts          # 市场深度
│   │   │   ├── company.ts         # 企业价格
│   │   │   ├── leaderboard.ts     # 排行榜数据
│   │   │   └── mailbox.ts         # 信箱 + 15s 轮询（MVP 8.0）
│   │   ├── views/           # 页面组件
│   │   │   ├── FarmView.vue       # 农场主页（含资金链仪表盘 + 种子站）
│   │   │   ├── FarmStats.vue      # 农场统计
│   │   │   ├── PlotGrid.vue       # 土地网格
│   │   │   ├── PlotCard.vue       # 单块土地卡片
│   │   │   ├── MarketView.vue     # 市场页（含企业面板 + 新闻）
│   │   │   ├── OrderTable.vue     # 盘口深度表
│   │   │   ├── UserView.vue       # 仓储中心（阶级徽章 + 净值 + 房产 + 仓储卡片）
│   │   │   ├── LoginView.vue      # 登录页
│   │   │   └── NotFoundView.vue   # 404
│   │   ├── types/           # TypeScript 类型
│   │   ├── utils/
│   │   │   └── format.ts          # 全局格式化（🪙/吨/百分比/时间）
│   │   ├── config/          # 游戏配置
│   │   │   ├── gameData.ts        # 游戏配置数据
│   │   │   ├── crops.ts           # 作物配置
│   │   │   └── housing.ts         # 20 阶房产配置 + 双重计价（MVP 7.0/8.1）
│   │   ├── router/          # 路由配置
│   │   └── styles/          # 全局样式
│   └── ...
└── server/                  # Express 后端
    ├── prisma/
    │   └── schema.prisma    # 数据模型定义（8 表）
    ├── src/
    │   ├── index.ts         # Express 入口
    │   ├── prisma.ts        # PrismaClient 单例
    │   ├── seed.ts          # 种子数据
    │   ├── config/          # 配置
    │   │   ├── crops.ts           # 作物定义
    │   │   ├── companies.ts       # 企业定义
    │   │   ├── economy_matrix.ts  # 经济矩阵
    │   │   └── housing_matrix.ts  # 20 阶房产矩阵 + 双重计价（MVP 7.0/8.1）
    │   ├── services/
    │   │   └── priceEngine.ts     # 价格波动引擎
    │   ├── middleware/
    │   │   ├── auth.ts            # JWT 鉴权
    │   │   └── upkeep.ts          # 地租结算
    │   └── routes/
    │       ├── auth.ts            # 登录/注册
    │       ├── farm.ts            # 农场操作
    │       ├── market.ts          # 市场交易
    │       ├── user.ts            # 玩家信息
    │       ├── leaderboard.ts     # 排行榜
    │       ├── social.ts          # 公开名片 + 房产升级（MVP 7.0）
    │       └── mailbox.ts         # 信箱 + OTC 暗池交易（MVP 8.0）
    └── ...
```
