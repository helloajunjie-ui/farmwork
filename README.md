# 🌾 赛博农场 (Text-First Farm Game)

> **文字先行 · 轻量高效 · 反通胀经济 · 阶级榜单**  
> 一款纯文字界面的农场经营游戏 MVP，采用 Vue 3 + Express + SQLite 全栈架构。

---

## ✨ 核心玩法

| 操作 | 说明 |
|------|------|
| 🌱 **播种** | 消耗 1 种子，等待作物成熟 |
| 🔪 **收割** | 获得 3 单位作物 |
| 🏪 **市场** | 挂单出售作物 / 从盘口买入 |
| 🏢 **企业直售** | 直接卖给 NPC 企业（系统保证成交） |
| 🔓 **解锁土地** | 消耗金币解锁更多土地（最多 12 块） |
| 🐮 **打工牛** | 一次性购买，自动离线播种/收割 |
| 🏆 **排行榜** | 双轨制：农夫新星榜 vs 资本巨鳄榜 |
| 🏢 **仓储中心** | 查看资产结构、库存容量、阶级徽章 |

### 经济循环

```
播种 → 收获(3作物) → 市场/企业卖出 → 赚金币 → 解锁土地(100~128000) → 更多产出
                                                                   ↓
                                                             购买打工牛(5000) → 离线自动化
```

### 解锁价格曲线

| 地块 | 7 | 8 | 9 | 10 | 11 | 12 |
|------|---|---|---|---|---|---|
| 价格 | 100 | 500 | 2,000 | 8,000 | 32,000 | 128,000 |

---

## 🏗️ 项目结构

```
nongchang/
├── ARCHITECTURE.md          # 架构总览
├── README.md                # 本文件
├── docs/
│   ├── api-contract.md      # API 契约文档（15+ 个端点）
│   ├── database-ddl.md      # 数据库设计（7 表）
│   └── frontend-architecture.md  # 前端架构
├── client/                  # Vue 3 前端
│   ├── src/
│   │   ├── api/             # API 层（真实 + Mock）
│   │   ├── components/      # 通用组件（AppHeader/Footer, LeaderboardModal, SellModal 等）
│   │   ├── stores/          # Pinia 状态管理（user/farm/market/company/leaderboard）
│   │   ├── views/           # 页面组件（Farm/Market/User/Login）
│   │   ├── types/           # TypeScript 类型
│   │   ├── utils/           # 工具函数（format.ts 全局格式化）
│   │   ├── config/          # 游戏配置（crops, gameData）
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
    │   ├── config/          # 配置（crops, companies, economy_matrix）
    │   ├── services/        # 业务服务（priceEngine）
    │   ├── middleware/      # 中间件（auth, upkeep）
    │   └── routes/          # API 路由（auth/farm/market/user/leaderboard）
    └── ...
```

---

## 🚀 快速启动

### 前置要求

- Node.js 18+
- npm

### 1. 启动后端

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npx tsx src/seed.ts    # 初始化测试数据
npx tsx src/index.ts   # 启动后端（端口 3000）
```

### 2. 启动前端

```bash
cd client
npm install
npx vite --host 0.0.0.0  # 启动前端（端口 5173）
```

### 测试账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| `demo` | `demo123` | 测试玩家 |
| `admin` | `admin123` | 管理员 |

---

## 🛠️ 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 前端 | Vue 3 + Pinia + TailwindCSS | 文字优先 UI |
| 构建 | Vite | 极速 HMR |
| 后端 | Express + TypeScript | RESTful API |
| ORM | Prisma 6 | 数据库操作 |
| 数据库 | SQLite | 轻量持久化 |
| 认证 | JWT | 无状态鉴权 |

---

## 📐 核心设计

- **服务器时间为唯一真理** — 所有生长判定基于服务器时间戳
- **ACID 事务** — 所有资产变更在事务中完成
- **行级锁** — 市场购买使用 `SELECT ... FOR UPDATE`
- **O(1) 离线结算** — 打工牛使用时间差公式，零 cron 开销
- **指数级金币回收** — 土地解锁成本指数递增，对抗通胀
- **价格波动引擎** — 每 60 秒 tick，5% 概率触发宏观事件
- **相位延迟种子定价** — 种子价滞后于收购价 ~5 分钟，创造套利窗口
- **双轨制排行榜** — 农夫新星榜(≤6块地) vs 资本巨鳄榜(>6块地)
- **全局单位格式化** — 所有数字带 🪙/吨 单位，杜绝光秃秃的数字

---

## 📄 文档

| 文档 | 说明 |
|------|------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 系统架构总览 |
| [`docs/api-contract.md`](docs/api-contract.md) | API 契约（15+ 个端点） |
| [`docs/database-ddl.md`](docs/database-ddl.md) | 数据库设计（7 表 + 事务 SQL） |
| [`docs/frontend-architecture.md`](docs/frontend-architecture.md) | 前端架构（组件树 + 数据流） |

---

## 📜 版本历史

| 版本 | 内容 |
|------|------|
| MVP 1.0 | 基础农场循环 + 市场交易 |
| MVP 1.1 | 土地解锁系统 + 打工牛离线自动化 |
| MVP 3.0 | 多作物系统 + NPC 企业 + 价格波动引擎 |
| MVP 4.0 | 地租机制 + 破产清算 + 相位延迟种子定价 |
| MVP 4.1 | 产业链经济矩阵（9 种作物，5 大品类） |
| MVP 4.2 | 市场深度聚合 + 盘口 UI |
| MVP 4.3 | 市场按作物过滤 + 我的挂单管理 |
| MVP 5.0 | JWT 认证系统 + 登录/注册 |
| MVP 5.1 | 新手引导（500 金币 + 30 小麦 + 30 种子） |
| MVP 5.2 | App 级移动端 UX（TabBar + Bottom Sheet + 防误触） |
| **MVP 6.0** | **阶级榜单 + 仓储美学（单位格式化 + 排行榜 + 仓储大仓）** |
