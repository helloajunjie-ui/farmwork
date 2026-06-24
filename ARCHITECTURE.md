# 🏡 赛博农场 — 架构总览

> **版本**: MVP 6.0 (阶级榜单 & 仓储美学)  
> **哲学**: 文字先行 · 轻量高效 · 反通胀经济 · 周期博弈

---

## 一、系统分层

```
┌─────────────────────────────────────────────┐
│            Presentation Layer                │
│   Vue 3 SPA (Vite + Pinia + TailwindCSS)    │
│   Text-First UI · 纯静态 · 可部署 Vercel     │
│   移动端: Bottom Sheet + TabBar              │
│   PC端: 居中模态框 + Header                  │
├─────────────────────────────────────────────┤
│            Business Gateway Layer            │
│   Express + TypeScript · RESTful API         │
│   Server Time = 唯一真理 · ACID 事务         │
│   价格波动引擎 · 地租结算中间件               │
│   JWT 鉴权 · 排行榜引擎                      │
├─────────────────────────────────────────────┤
│            Persistence Layer                 │
│   SQLite · Prisma ORM                        │
│   行级锁 FOR UPDATE · 时间差 O(1) 离线结算   │
└─────────────────────────────────────────────┘
```

### 核心原则

| 原则 | 说明 |
|------|------|
| **服务器时间为唯一真理** | 所有生长/成熟判定基于服务器时间戳，绝不信任客户端 |
| **ACID 事务** | 所有资产变更（播种/收割/挂单/购买/解锁）在事务中完成 |
| **行级锁防并发** | 市场购买使用 `SELECT ... FOR UPDATE` 锁定订单行 |
| **O(1) 离线结算** | 打工牛 + 地租均使用时间差公式，零 cron 开销 |
| **指数级金币回收** | 土地解锁成本指数递增 + 地租指数递增，对抗通胀 |
| **蛛网经济模型** | 种子价格滞后于收购价 ~5 分钟，创造套利窗口 |
| **双轨制排行榜** | 农夫新星榜(≤6块地) vs 资本巨鳄榜(>6块地)，动态净值计算 |
| **全局单位格式化** | 所有数字必须带 🪙/吨 单位，杜绝光秃秃的数字 |

---

## 二、数据流

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐
│  User    │    │  Farm    │    │  Market  │    │ Company  │    │ Leaderboard  │
│  Store   │    │  Store   │    │  Store   │    │  Store   │    │   Store      │
├──────────┤    ├──────────┤    ├──────────┤    ├──────────┤    ├──────────────┤
│ gold     │    │ plots[]  │    │ depth[]  │    │companies │    │ farmers[]    │
│ items    │    │ cowStatus│    │ myOrders │    │ events[] │    │ capitalists[]│
│ upkeep   │    │ loading  │    │ loading  │    │ loading  │    │ loading      │
│ health%  │    └────┬─────┘    └────┬─────┘    └────┬─────┘    └──────┬───────┘
└────┬─────┘         │               │               │                │
     │               └───────────────┼───────────────┘────────────────┘
     │                               │
     ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│                  (Axios / Mock 双模式)                        │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP / Mock
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                Express API (RESTful)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │  routes/  │ │services/ │ │ middleware/  │ │  config/    │ │
│  │ auth.ts   │ │priceEng. │ │ auth.ts      │ │ crops.ts    │ │
│  │ farm.ts   │ │          │ │ upkeep.ts    │ │ companies.ts│ │
│  │ market.ts │ └──────────┘ └──────────────┘ │ economy_    │ │
│  │ user.ts   │                               │ matrix.ts   │ │
│  │ leaderboard.ts                            └─────────────┘ │
│  └──────────┘                                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │ Prisma
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                       SQLite                                  │
│  7 tables: users, inventory, plots, cows, market_orders,     │
│  market_environment, market_events                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型 (7 表)

| 表 | 用途 | 关键字段 |
|----|------|----------|
| [`users`](server/prisma/schema.prisma) | 玩家 | `gold` (CHECK ≥ 0), `upkeep_rate`, `last_upkeep_at`, `is_bankrupt` |
| [`inventory`](server/prisma/schema.prisma) | 物品库存 | 复合主键 `(user_id, item)` |
| [`plots`](server/prisma/schema.prisma) | 土地 | `status` (locked/idle/growing/ready), `unlock_price` |
| [`cows`](server/prisma/schema.prisma) | 打工牛 | `active`, `last_sync_at` (O(1) 离线结算) |
| [`market_orders`](server/prisma/schema.prisma) | 市场订单 | `status` (active/sold/cancelled), `unit_price` |
| [`market_environment`](server/prisma/schema.prisma) | 宏观环境 | `crop_id`, `buy_price`, `seed_target_price`, `updated_at` |
| [`market_events`](server/prisma/schema.prisma) | 宏观事件 | `crop_id`, `event_type`, `title`, `price_modifier`, `expires_at` |

---

## 四、API 清单 (~20 个端点)

| 方法 | 路径 | 说明 | 事务 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录/注册（JWT） | ✅ |
| GET | `/api/user/info` | 玩家信息 + 库存 + 地租健康度 | - |
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
| **GET** | **`/api/leaderboard`** | **双轨制排行榜（农夫榜 + 资本榜）** | **-** |

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
│   │   │   ├── AppHeader.vue      # PC 端顶栏
│   │   │   ├── AppFooter.vue      # 移动端 TabBar
│   │   │   ├── GoldDisplay.vue    # 金币显示（formatGold）
│   │   │   ├── InventoryBadge.vue # 库存徽章（formatAmountCompact）
│   │   │   ├── LeaderboardModal.vue # 排行榜（PC模态框 + 移动端Bottom Sheet）
│   │   │   └── SellModal.vue      # 卖单弹窗
│   │   ├── stores/          # Pinia 状态管理
│   │   │   ├── user.ts            # 玩家信息
│   │   │   ├── farm.ts            # 农场状态
│   │   │   ├── market.ts          # 市场深度
│   │   │   ├── company.ts         # 企业价格
│   │   │   └── leaderboard.ts     # 排行榜数据
│   │   ├── views/           # 页面组件
│   │   │   ├── FarmView.vue       # 农场主页（含资金链仪表盘 + 种子站）
│   │   │   ├── FarmStats.vue      # 农场统计
│   │   │   ├── PlotGrid.vue       # 土地网格
│   │   │   ├── PlotCard.vue       # 单块土地卡片
│   │   │   ├── MarketView.vue     # 市场页（含企业面板 + 新闻）
│   │   │   ├── OrderTable.vue     # 盘口深度表
│   │   │   ├── UserView.vue       # 仓储中心（阶级徽章 + 净值 + 仓储卡片）
│   │   │   ├── LoginView.vue      # 登录页
│   │   │   └── NotFoundView.vue   # 404
│   │   ├── types/           # TypeScript 类型
│   │   ├── utils/
│   │   │   └── format.ts          # 全局格式化（🪙/吨/百分比/时间）
│   │   ├── config/          # 游戏配置
│   │   ├── router/          # 路由配置
│   │   └── styles/          # 全局样式
│   └── ...
└── server/                  # Express 后端
    ├── prisma/
    │   └── schema.prisma    # 数据模型定义
    ├── src/
    │   ├── index.ts         # Express 入口
    │   ├── prisma.ts        # PrismaClient 单例
    │   ├── seed.ts          # 种子数据
    │   ├── config/          # 配置
    │   │   ├── crops.ts           # 作物定义
    │   │   ├── companies.ts       # 企业定义
    │   │   └── economy_matrix.ts  # 经济矩阵
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
    │       └── leaderboard.ts     # 排行榜
    └── ...
```
