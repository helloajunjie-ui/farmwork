# 前端架构文档 (Vue 3 + Pinia + Text-First UI)

> **框架**: Vue 3 (Composition API) + TypeScript  
> **状态管理**: Pinia  
> **路由**: Vue Router 4  
> **HTTP**: Axios  
> **构建**: Vite  
> **部署**: 纯静态，可部署至 Vercel / Nginx

---

## 一、组件树 (Component Tree)

```
App.vue
├── AppHeader.vue              # 顶部导航栏：玩家资产概览
│   ├── GoldDisplay.vue        # 金币显示
│   └── InventoryBadge.vue     # 库存快捷显示（玉米/小麦/啤酒花/种子）
│
├── router-view
│   ├── FarmView.vue           # 🏠 农场主页（默认路由 /）
│   │   ├── FarmStats.vue      # 农场统计（总土地/锁定/种植中/可收割）
│   │   ├── [CashFlowDashboard] # 资金链仪表盘（>10块地时显示）
│   │   │   ├── HealthBar      # 健康度进度条（绿/黄/红）
│   │   │   ├── UpkeepRate     # 地租费率显示
│   │   │   └── MinutesRemaining # 剩余可支撑分钟数
│   │   ├── [CowPanel]         # 打工牛状态栏 / 购买入口（内联在 FarmView）
│   │   ├── [SeedStation]      # 种子站（含利润计算器）
│   │   │   └── ProfitWarning  # 利润预警（红色，播种即亏损时显示）
│   │   ├── PlotGrid.vue       # 土地网格列表
│   │   │   └── PlotCard.vue   # 单块土地卡片（×N）
│   │   │       ├── LockedState    # 🔒 锁定状态（斜纹背景 + 金币价格）
│   │   │       ├── IdleState      # 空闲状态（播种按钮）
│   │   │       ├── GrowingState   # 生长中状态（倒计时）
│   │   │       └── ReadyState     # 已成熟状态（收割按钮）
│   │   ├── [BankruptcyOverlay] # 破产清算全屏动画（is_bankrupt 时触发）
│   │   └── ErrorToast         # 错误提示（fixed 底部）
│   │
│   ├── MarketView.vue         # 🏪 市场页面（路由 /market）
│   │   ├── MarketHeader.vue   # 市场标题 + 发布卖单按钮
│   │   ├── OrderTable.vue     # 深度列表（按单价聚合，地板价红框高亮）
│   │   ├── [CompanyPanel]     # NPC 企业直购面板（B2B 模式）
│   │   ├── [NewsTicker]       # 宏观新闻跑马灯
│   │   └── SellModal.vue      # 发布卖单弹窗（含单价输入 + 自动计算总收入）
│   │
│   └── NotFoundView.vue       # 404 页面
│
└── AppFooter.vue              # 底部导航（农场 / 市场）
```

> `[Brackets]` 表示内联在父组件中的片段，非独立组件文件。

---

## 二、Pinia Store 数据流

### 2.1 `useUserStore` — 玩家信息

```typescript
// stores/user.ts
interface UpkeepInfo {
  rate: number                // 地租费率（🪙/min）
  minutes_remaining: number   // 当前金币可支撑分钟数
  unlocked_plots: number      // 已解锁土地数
  is_bankrupt: boolean        // 是否破产
}

interface UserState {
  userId: number
  nickname: string
  gold: number
  items: Record<string, number>  // { corn: 0, seed: 10, wheat: 0, hops: 0 }
  avatarUrl: string | null
  upkeep: UpkeepInfo | null      // MVP 4.0 地租健康度
}

// Computed (资金链健康度)
healthPercent       // 0~100%，基于 minutes_remaining / 60
healthColor         // 'green' | 'yellow' | 'red'
healthBarColor      // TailwindCSS class
showUpkeepWarning   // unlocked_plots > 10
justBankrupted      // 触发破产动画的标志

// Actions
fetchUserInfo()        // GET /api/user/info → 填充 state
```

### 2.2 `useFarmStore` — 农场状态

```typescript
// stores/farm.ts
type PlotStatus = 'locked' | 'idle' | 'growing' | 'ready'

interface Plot {
  plotId: number
  status: PlotStatus
  plantedAt: number | null
  crop: string | null          // 'wheat' | 'corn' | 'hops'
  remainingSeconds: number
  unlockPrice: number | null
}

interface CowStatus {
  hasCow: boolean
  active: boolean
  lastSyncAt: number | null
}

interface FarmState {
  plots: Plot[]
  loading: boolean
  error: string | null
  cowStatus: CowStatus
  unlocking: Set<number>       // 正在解锁中的 plot_id 集合
  seedPrice: number | null     // 当前种子动态价格
}

// Actions
fetchPlots()              // GET /api/farm/plots
plant(plotId, crop)       // POST /api/farm/plant → 成功后重新 fetchPlots
harvest(plotId)           // POST /api/farm/harvest → 成功后重新 fetchPlots + fetchUserInfo
unlockPlot(plotId)        // POST /api/farm/unlock → 成功后重新 fetchPlots + fetchUserInfo
buyCow()                  // POST /api/farm/buy-cow → 成功后重新 fetchCowStatus + fetchUserInfo
fetchCowStatus()          // GET /api/farm/cow-status
buySeed(amount, crop?)    // POST /api/farm/buy-seed → 成功后重新 fetchUserInfo
fetchSeedPrice(cropId)    // GET /api/farm/seed-price → 更新 seedPrice
startTick()               // 启动本地倒计时引擎（1秒间隔）
stopTick()                // 停止倒计时引擎
```

### 2.3 `useMarketStore` — 市场状态

```typescript
// stores/market.ts
interface DepthItem {
  unitPrice: number
  totalAmount: number
  orderCount: number
}

interface MyOrder {
  id: number
  item: string
  amount: number
  unitPrice: number
  totalPrice: number
  status: string
  createdAt: number
}

interface MarketState {
  depth: DepthItem[]
  myOrders: MyOrder[]
  loading: boolean
}

// Actions
fetchOrderBook()         // GET /api/market/orders
sell(item, amount, unitPrice)  // POST /api/market/sell → 成功后重新 fetchOrderBook + fetchUserInfo
buy(orderId)             // POST /api/market/buy → 成功后重新 fetchOrderBook + fetchUserInfo
startPolling()           // 启动 3 秒 SWR 轮询
stopPolling()            // 停止轮询
```

### 2.4 `useCompanyStore` — 企业状态 (MVP 3.0)

```typescript
// stores/company.ts
interface CompanyInfo {
  id: string
  name: string
  description: string
  buyItem: string
  basePrice: number
  currentPrice: number
  priceTrend: 'up' | 'down' | 'stable'
  icon: string
}

interface MarketEvent {
  title: string
  cropId: string
}

interface CompanyState {
  companies: CompanyInfo[]
  events: MarketEvent[]
  loading: boolean
}

// Actions
fetchCompanies()              // GET /api/market/companies
sellToCompany(companyId, amount) // POST /api/market/sell-to-company
```

---

## 三、核心交互流程

### 3.1 农场倒计时机制

```
┌─────────────────────────────────────────────────────┐
│  FarmView.vue (onMounted)                           │
│  1. fetchPlots() → 获取所有土地状态                  │
│  2. fetchCowStatus() → 获取打工牛状态                │
│  3. fetchSeedPrice() → 获取动态种子价格              │
│  4. 启动 setInterval(1000ms) 定时器                  │
│     ↓                                                │
│  5. 遍历 plots，对 status === 'growing' 的土地：      │
│     remainingSeconds = max(0, plantedAt + 生长周期 - now) │
│     ↓                                                │
│  6. 当 remainingSeconds === 0 时，status 变为 'ready' │
│  7. onUnmounted → clearInterval()                    │
└─────────────────────────────────────────────────────┘
```

> **关键设计**：倒计时完全由前端本地计算，不轮询后端。  
> 收割时后端做最终校验，保证安全性。

### 3.2 土地解锁流程

```
┌─ 用户点击锁定土地 ────────────────────────────────┐
│  1. 弹出确认（或直接解锁）                          │
│  2. 按钮显示 ⏳ 解锁中... 并禁用                    │
│  3. POST /api/farm/unlock { plot_id }              │
│  4. 成功 → 刷新土地列表 + 刷新金币                  │
│  5. 失败 → 显示错误提示（"金币不足"等）             │
└─────────────────────────────────────────────────────┘
```

### 3.3 打工牛购买流程

```
┌─ 用户点击 [🐮 雇佣] ──────────────────────────────┐
│  1. 按钮显示 "购买中..." 并禁用                     │
│  2. POST /api/farm/buy-cow                         │
│  3. 成功 → 购买入口消失，显示打工牛状态栏            │
│  4. 失败 → 显示错误提示（"金币不足"等）             │
└─────────────────────────────────────────────────────┘
```

### 3.4 市场购买防并发

```
┌─ 买家点击 [立即买下] ──────────────────────────────┐
│  1. 前端立即禁用该按钮（防重复点击）                  │
│  2. POST /api/market/buy { order_id }               │
│  3. 后端行级锁 FOR UPDATE 保证原子性                 │
│  4. 成功 → 刷新订单列表 + 刷新玩家资产               │
│  5. 失败 → 显示错误提示（"已被买走" / "金币不足"）   │
└─────────────────────────────────────────────────────┘
```

### 3.5 资金链健康度监控 (MVP 4.0)

```
┌─ 每次 fetchUserInfo ──────────────────────────────┐
│  1. 后端结算地租（O(1) 时间差）                     │
│  2. 返回 upkeep 信息                               │
│  3. 前端计算 healthPercent                         │
│     ├─ >60% → 绿色（健康）                         │
│     ├─ 30~60% → 黄色（警告）                       │
│     └─ <30% → 红色（危险）                         │
│  4. 如果 is_bankrupt === true                      │
│     → 触发 justBankrupted = true                   │
│     → 显示全屏清算动画 + shake 效果                │
│     → 3秒后自动关闭                                │
└─────────────────────────────────────────────────────┘
```

### 3.6 种子站利润计算 (MVP 4.0)

```
┌─ 用户选择作物 ────────────────────────────────────┐
│  1. fetchSeedPrice(cropId) → 获取动态种子价        │
│  2. 计算预期收入 = 3 × 当前企业收购价              │
│  3. 计算种子成本 = 种子价                          │
│  4. 计算利润 = 预期收入 - 种子成本                 │
│  5. 如果利润 < 0 → 显示 ⚠️ 播种即亏损！红色警告    │
└─────────────────────────────────────────────────────┘
```

---

## 四、UI/UX 规范 (Text-First)

### 4.1 色彩系统

| 用途 | 色值 | 说明 |
|------|------|------|
| 背景 | `#0f172a` (slate-900) | 深色背景，护眼 |
| 卡片 | `#1e293b` (slate-800) | 卡片底色 |
| 主文字 | `#f1f5f9` (slate-100) | 常规文字 |
| 次要文字 | `#64748b` (slate-400) | 辅助信息 |
| 成功/成熟 | `#4ade80` (green-400) | 可收割状态 |
| 警告/生长 | `#facc15` (yellow-400) | 生长中状态 |
| 空闲 | `#64748b` (slate-400) | 空闲土地 |
| 锁定 | `#334155` (slate-700) | 锁定土地（斜纹背景） |
| 强调 | `#60a5fa` (blue-400) | 播种按钮 |
| 金币 | `#f59e0b` (amber-500) | 金币相关 |
| 危险/亏损 | `#ef4444` (red-500) | 亏损警告、破产动画 |
| 买入价 | `#22c55e` (green-500) | 市场买入价（绿色） |
| 卖出价 | `#ef4444` (red-500) | 市场卖出价（红色） |

### 4.2 状态卡片样式

```
┌─────────────────────┐
│  🔒 锁定土地 #7     │  ← 斜纹背景 + 深色
│      🪙 100 金币    │  ← 解锁价格
│   [🔓 解锁]         │  ← 蓝色按钮
└─────────────────────┘

┌─────────────────────┐
│  🟫 空闲土地 #1     │  ← 灰色边框
│   [🌱 播种]         │  ← 蓝色按钮
└─────────────────────┘

┌─────────────────────┐
│  🌽 生长中...       │  ← 黄色边框
│  剩余 14:59         │  ← 等宽字体倒计时
└─────────────────────┘

┌─────────────────────┐
│  🌽 玉米已成熟 🎉   │  ← 绿色边框 + 发光
│   [🔪 收割]         │  ← 绿色按钮
└─────────────────────┘
```

### 4.3 打工牛 UI

```
┌─ 未购买 ─────────────────────────────────────┐
│  🐂 雇佣打工牛                                │
│  自动播种 · 离线收益 · 仅需 5,000 金币  [🐮 雇佣] │
└──────────────────────────────────────────────┘

┌─ 已购买 ─────────────────────────────────────┐
│  🐮 打工牛 · 工作中 · 上次同步: 14:30        │
└──────────────────────────────────────────────┘
```

### 4.4 资金链仪表盘 (MVP 4.0)

```
┌─ 资金链健康度 ────────────────────────────────┐
│  ████████████░░░░░░  65%                     │  ← 绿/黄/红进度条
│  地租: -2 🪙/min  ·  可支撑 32 分钟          │
│  ⚠️ 超过 10 块地后地租指数增长               │
└──────────────────────────────────────────────┘

┌─ 破产清算（全屏覆盖） ────────────────────────┐
│  ⚠️ 资不抵债                                  │  ← shake 动画
│  您的土地已被银行强制收回法拍                   │
│  🔒 土地 #12 已被锁定（返还 5 🪙）            │
│  🔒 土地 #11 已被锁定（返还 5 🪙）            │
└──────────────────────────────────────────────┘
```

### 4.5 种子站利润计算器 (MVP 4.0)

```
┌─ 🌱 种子站 ──────────────────────────────────┐
│  选择作物: [🌾 小麦] [🌽 玉米] [🍺 啤酒花]    │
│                                              │
│  当前种子价: 5 🪙                             │
│  企业收购价: 6 🪙                             │
│  预期收入: 18 🪙 (3 × 6)                     │
│  种子成本: 5 🪙                               │
│  ─────────────────────                        │
│  利润: +13 🪙 ✅                              │  ← 绿色
│  ⚠️ 播种即亏损！                              │  ← 红色（利润<0时）
└──────────────────────────────────────────────┘
```

### 4.6 状态反馈

| 场景 | 反馈 |
|------|------|
| 页面加载 | 骨架屏（灰色占位块 + 脉冲动画） |
| 操作进行中 | 按钮显示 `⏳ 处理中...` 并禁用 |
| 操作成功 | 按钮短暂闪绿后恢复 |
| 操作失败 | 底部 Toast 红色错误提示，3秒后自动消失 |
| 空状态 | 市场无订单时显示 `📭 市场上空空如也，快来发布第一单吧` |
| 网络错误 | 页面顶部 Toast: `⚠️ 网络开小差了，请稍后重试` |
| 破产清算 | 全屏暗色遮罩 + shake 动画 + 土地法拍清单，3秒后自动关闭 |

---

## 五、路由设计

```typescript
// router/index.ts
const routes = [
  {
    path: '/',
    name: 'farm',
    component: FarmView,
    meta: { title: '🏠 我的农场' }
  },
  {
    path: '/market',
    name: 'market',
    component: MarketView,
    meta: { title: '🏪 市场' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { title: '404 迷路了' }
  }
]
```

---

## 六、目录结构

```
client/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── favicon.ico
└── src/
    ├── main.ts                  # 入口
    ├── App.vue                  # 根组件
    ├── router/
    │   └── index.ts             # 路由配置
    ├── stores/
    │   ├── user.ts              # 玩家信息 store（含地租健康度）
    │   ├── farm.ts              # 农场 store（含种子价格）
    │   ├── market.ts            # 市场 store（深度 + 轮询）
    │   └── company.ts           # 企业 store（NPC + 宏观事件）
    ├── api/
    │   ├── index.ts             # Axios 实例 + 真实 API 函数
    │   └── mock.ts              # Mock 实现（纯前端模拟）
    ├── components/
    │   ├── AppHeader.vue
    │   ├── AppFooter.vue
    │   ├── GoldDisplay.vue
    │   ├── InventoryBadge.vue
    │   └── SellModal.vue
    ├── views/
    │   ├── FarmView.vue         # 农场主页（含资金链仪表盘 + 种子站 + 破产动画）
    │   ├── FarmStats.vue
    │   ├── PlotGrid.vue
    │   ├── PlotCard.vue
    │   ├── MarketView.vue       # 市场页（含企业面板 + 新闻跑马灯）
    │   ├── OrderTable.vue
    │   └── NotFoundView.vue
    ├── types/
    │   └── index.ts             # TypeScript 类型定义
    └── styles/
        └── main.css             # 全局样式（TailwindCSS + 清算动画）
```
