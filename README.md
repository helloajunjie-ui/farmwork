# 🌾 文字农场 (Text-First Farm Game)

> **文字先行 · 轻量高效 · 反通胀经济**  
> 一款纯文字界面的农场经营游戏 MVP，采用 Vue 3 + Express + PostgreSQL 全栈架构。

---

## ✨ 核心玩法

| 操作 | 说明 |
|------|------|
| 🌱 **播种** | 消耗 1 种子，等待 28 分钟 |
| 🔪 **收割** | 获得 3 玉米 |
| 🏪 **市场** | 挂单出售玉米，赚取金币 |
| 🔓 **解锁土地** | 消耗金币解锁更多土地（最多 12 块） |
| 🐮 **打工牛** | 一次性购买，自动离线播种/收割 |

### 经济循环

```
播种 → 收获(3玉米) → 市场卖出 → 赚金币 → 解锁土地(100~128000) → 更多产出
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
│   ├── api-contract.md      # API 契约文档（10 个端点）
│   ├── database-ddl.md      # 数据库设计（5 表）
│   └── frontend-architecture.md  # 前端架构
├── client/                  # Vue 3 前端
│   ├── src/
│   │   ├── api/             # API 层（真实 + Mock）
│   │   ├── components/      # 通用组件
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── views/           # 页面组件
│   │   ├── types/           # TypeScript 类型
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
    │   └── routes/          # API 路由
    └── ...
```

---

## 🚀 快速启动

### 前置要求

- Node.js 18+
- PostgreSQL 14+

### 1. 启动前端（Mock 模式）

```bash
cd client
npm install
npx vite --host 0.0.0.0
```

前端运行在 `http://localhost:5173`，使用 Mock 数据（28 秒生长周期，方便测试）。

### 2. 启动后端（完整模式）

```bash
# 配置数据库
cp server/.env.example server/.env
# 编辑 .env 填入数据库连接信息

cd server
npm install
npx prisma generate
npx prisma db push
npx tsx src/seed.ts
npx tsx src/index.ts
```

后端运行在 `http://localhost:3000`。

---

## 🛠️ 技术栈

| 层 | 技术 | 用途 |
|----|------|------|
| 前端 | Vue 3 + Pinia + TailwindCSS | 文字优先 UI |
| 构建 | Vite | 极速 HMR |
| 后端 | Express + TypeScript | RESTful API |
| ORM | Prisma 6 | 数据库操作 |
| 数据库 | PostgreSQL 14+ | 持久化 |
| 部署 | Vercel / Nginx | 静态托管 |

---

## 📐 核心设计

- **服务器时间为唯一真理** — 所有生长判定基于服务器时间戳
- **ACID 事务** — 所有资产变更在事务中完成
- **行级锁** — 市场购买使用 `SELECT ... FOR UPDATE`
- **O(1) 离线结算** — 打工牛使用时间差公式，零 cron 开销
- **指数级金币回收** — 土地解锁成本指数递增，对抗通胀

---

## 📄 文档

| 文档 | 说明 |
|------|------|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | 系统架构总览 |
| [`docs/api-contract.md`](docs/api-contract.md) | API 契约（10 个端点） |
| [`docs/database-ddl.md`](docs/database-ddl.md) | 数据库设计（5 表 + 事务 SQL） |
| [`docs/frontend-architecture.md`](docs/frontend-architecture.md) | 前端架构（组件树 + 数据流） |

---

## 📜 版本历史

| 版本 | 内容 |
|------|------|
| MVP 1.0 | 基础农场循环 + 市场交易 |
| MVP 1.1 | 土地解锁系统 + 打工牛离线自动化 |
