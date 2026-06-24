# 赛博农场 API 契约文档 (MVP 6.0)

> **协议**: RESTful over HTTP  
> **数据格式**: JSON  
> **认证方式**: `Authorization: Bearer <token>` (JWT)  
> **基础路径**: `http://localhost:3000/api`

---

## 目录

1. [通用约定](#通用约定)
2. [API 列表](#api-列表)
   - [1. POST /api/auth/login](#1-post-apiauthlogin)
   - [2. GET /api/user/info](#2-get-apiuserinfo)
   - [3. GET /api/farm/plots](#3-get-apifarmplots)
   - [4. POST /api/farm/plant](#4-post-apifarmplant)
   - [5. POST /api/farm/harvest](#5-post-apifarmharvest)
   - [6. POST /api/farm/unlock](#6-post-apifarmunlock)
   - [7. POST /api/farm/buy-cow](#7-post-apifarmbuy-cow)
   - [8. GET /api/farm/cow-status](#8-get-apifarmcow-status)
   - [9. POST /api/farm/buy-seed](#9-post-apifarmbuy-seed)
   - [10. GET /api/farm/seed-price](#10-get-apifarmseed-price)
   - [11. GET /api/market/orders](#11-get-apimarketorders)
   - [12. POST /api/market/sell](#12-post-apimarketsell)
   - [13. POST /api/market/buy](#13-post-apimarketbuy)
   - [14. GET /api/market/companies](#14-get-apimarketcompanies)
   - [15. POST /api/market/sell-to-company](#15-post-apimarketsell-to-company)
   - [**16. GET /api/leaderboard**](#16-get-apileaderboard)
3. [错误码规范](#错误码规范)

---

## 通用约定

### 响应结构

所有响应统一包裹在以下结构中：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `int` | 业务状态码，`0` 表示成功，非 `0` 表示错误 |
| `message` | `string` | 提示信息 |
| `data` | `object\|null` | 业务数据 |

### 时间格式

- 所有时间戳使用 **Unix 毫秒级时间戳**（`int64`），时区为 UTC+0
- 前端展示时转换为本地时间

### 认证

所有 API（除 `/api/auth/login` 和 `/api/health`）需要在 Header 中传入 JWT Token：

```
Authorization: Bearer <token>
```

Token 通过登录接口获取，有效期 7 天。

---

## API 列表

---

### 1. POST /api/auth/login

登录或自动注册。如果用户名不存在则自动创建新账号。

#### Request Body

```json
{
  "username": "demo",
  "password": "demo123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | `string` | 是 | 用户名，3~20 个字符 |
| `password` | `string` | 是 | 密码，6~32 个字符 |

#### Response `data` 结构

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "user_id": 1,
    "username": "demo",
    "nickname": "demo"
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `token` | `string` | JWT Token，有效期 7 天 |
| `user.user_id` | `int` | 玩家 ID |
| `user.username` | `string` | 用户名 |
| `user.nickname` | `string` | 昵称 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `9001` | 参数校验失败 | 用户名或密码格式不正确 |

---

### 2. GET /api/user/info

获取玩家个人信息及资产概况。

> **注意**: 此接口会触发地租结算（`settleUpkeep`），返回最新的资金链健康度数据。

#### Request

无参数。需携带 `Authorization: Bearer <token>`。

#### Response `data` 结构

```json
{
  "user_id": 1,
  "nickname": "青羽",
  "gold": 100,
  "items": {
    "corn": 0,
    "seed": 10,
    "wheat": 0,
    "hops": 0,
    "potato": 0,
    "tomato": 0,
    "cabbage": 0,
    "apple": 0,
    "grape": 0,
    "tobacco": 0,
    "ganoderma": 0
  },
  "avatar_url": null,
  "upkeep": {
    "rate": 0,
    "minutes_remaining": 999,
    "unlocked_plots": 6,
    "is_bankrupt": false
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `int` | 玩家 ID |
| `nickname` | `string` | 昵称 |
| `gold` | `int` | 金币数量 |
| `items` | `object` | 物品库存，key 为物品名，value 为数量 |
| `avatar_url` | `string\|null` | 头像 URL，后期扩展 |
| `upkeep` | `object` | 地租健康度信息 (MVP 4.0) |
| `upkeep.rate` | `int` | 地租费率（🪙/min） |
| `upkeep.minutes_remaining` | `int` | 当前金币可支撑的分钟数 |
| `upkeep.unlocked_plots` | `int` | 已解锁土地数 |
| `upkeep.is_bankrupt` | `bool` | 是否处于破产状态 |

---

### 3. GET /api/farm/plots

获取玩家所有土地的状态。

> **注意**: 此接口会触发打工牛离线结算 + 地租结算。

#### Request

无参数。需携带 `Authorization: Bearer <token>`。

#### Response `data` 结构

```json
{
  "plots": [
    {
      "plot_id": 1,
      "status": "idle",
      "planted_at": null,
      "crop": null,
      "remaining_seconds": 0,
      "unlock_price": null
    },
    {
      "plot_id": 2,
      "status": "growing",
      "planted_at": 1719200000,
      "crop": "corn",
      "remaining_seconds": 840,
      "unlock_price": null
    },
    {
      "plot_id": 7,
      "status": "locked",
      "planted_at": null,
      "crop": null,
      "remaining_seconds": 0,
      "unlock_price": 100
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `plot_id` | `int` | 土地编号 (1~N) |
| `status` | `string` | `locked` 锁定 \| `idle` 空闲 \| `growing` 生长中 \| `ready` 已成熟 |
| `planted_at` | `int\|null` | 播种时的 Unix 时间戳，空闲/锁定时为 `null` |
| `crop` | `string\|null` | 作物类型 |
| `remaining_seconds` | `int` | 剩余生长秒数，`idle`/`ready`/`locked` 时为 `0` |
| `unlock_price` | `int\|null` | 解锁所需金币，`locked` 状态时有效 |

> **生长周期**：小麦 10min, 玉米 28min, 土豆 20min, 番茄 15min, 白菜 12min, 苹果 45min, 葡萄 60min, 烟草 90min, 灵芝 120min

---

### 4. POST /api/farm/plant

对指定土地进行播种。

#### Request Body

```json
{
  "plot_id": 1,
  "crop": "corn"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plot_id` | `int` | 是 | 土地编号 |
| `crop` | `string` | 是 | 作物类型 |

#### Response `data` 结构

```json
{
  "plot_id": 1,
  "status": "growing",
  "planted_at": 1719201680,
  "remaining_seconds": 1680
}
```

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `1001` | 土地已被占用 | 该土地 `status` 不是 `idle` |
| `1002` | 种子不足 | 玩家 `seed` 库存 < 1 |
| `1003` | 不支持的作物 | `crop` 无效 |

---

### 5. POST /api/farm/harvest

收割指定土地上已成熟的作物。

#### Request Body

```json
{
  "plot_id": 2
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plot_id` | `int` | 是 | 土地编号 |

#### Response `data` 结构

```json
{
  "plot_id": 2,
  "status": "idle",
  "harvested": 3,
  "crop": "corn",
  "items": {
    "corn": 13,
    "seed": 9
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `harvested` | `int` | 本次收获的作物数量（固定 3） |
| `crop` | `string` | 收获的作物类型 |
| `items` | `object` | 收割后的最新库存快照 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `1101` | 该土地未播种 | `planted_at` 为 null |
| `1102` | 作物尚未成熟 | `now - planted_at < 生长周期` |

---

### 6. POST /api/farm/unlock

解锁一块被锁定的土地。

#### Request Body

```json
{
  "plot_id": 7
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `plot_id` | `int` | 是 | 土地编号 |

#### Response `data` 结构

```json
{
  "plot_id": 7,
  "status": "idle",
  "cost": 100
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `cost` | `int` | 本次解锁消耗的金币 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `1201` | 该土地无需解锁 | `status` 不是 `locked` |
| `1202` | 该土地无法解锁 | `unlock_price` 为 null |
| `1203` | 金币不足 | 玩家 `gold` < `unlock_price` |

---

### 7. POST /api/farm/buy-cow

购买一头打工牛（一次性消费 5000 金币）。

#### Request

无参数。

#### Response `data` 结构

```json
{
  "active": true,
  "last_sync_at": 1719200000
}
```

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `1301` | 已经拥有一头打工牛了 | 该玩家已有活跃的打工牛 |
| `1302` | 金币不足，需要 5000 金币 | 玩家 `gold` < 5000 |

---

### 8. GET /api/farm/cow-status

查询打工牛状态。

#### Request

无参数。

#### Response `data` 结构

```json
{
  "has_cow": true,
  "active": true,
  "last_sync_at": 1719200000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `has_cow` | `bool` | 是否拥有打工牛 |
| `active` | `bool` | 是否活跃 |
| `last_sync_at` | `int\|null` | 上次同步时间戳，没有打工牛时为 `null` |

---

### 9. POST /api/farm/buy-seed

批量购买种子。

> **注意**: 种子价格是动态的，受相位延迟引擎影响（MVP 4.0）。建议先调用 `GET /api/farm/seed-price` 查看当前价格。

#### Request Body

```json
{
  "amount": 10,
  "crop": "corn"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `amount` | `int` | 是 | 购买数量，必须 > 0 |
| `crop` | `string` | 否 | 作物类型，默认 `corn` |

#### Response `data` 结构

```json
{
  "amount": 10,
  "total_cost": 50,
  "unit_price": 5,
  "gold_remaining": 50
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `amount` | `int` | 实际购买数量 |
| `total_cost` | `int` | 总花费 |
| `unit_price` | `int` | 单价 |
| `gold_remaining` | `int` | 剩余金币 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `1401` | 金币不足 | 玩家 `gold` < `total_cost` |
| `1402` | 参数无效 | `amount` <= 0 |

---

### 10. GET /api/farm/seed-price

查询当前种子价格（动态定价）。

#### Request

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `crop` | query | `string` | 否 | 作物类型，默认 `corn` |

#### Response `data` 结构

```json
{
  "crop": "corn",
  "price": 5,
  "base_price": 4,
  "buy_price": 6
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `crop` | `string` | 作物类型 |
| `price` | `int` | 当前种子售价（动态） |
| `base_price` | `int` | 基础种子价 |
| `buy_price` | `int` | 当前企业收购价（参考） |

---

### 11. GET /api/market/orders

获取当前市场深度（聚合挂单列表）。支持按作物过滤。

#### Request

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| `item_id` | query | `string` | 否 | 作物类型，不传则返回所有 |

#### Response `data` 结构

```json
{
  "depth": [
    {
      "unit_price": 5,
      "total_amount": 30,
      "order_ids": [1, 2, 3]
    }
  ],
  "floor_price": 5,
  "my_orders": [
    {
      "id": 1,
      "unit_price": 5,
      "amount": 10,
      "total_price": 50,
      "created_at": 1719200000
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `depth[]` | `array` | 按单价聚合的深度列表 |
| `depth[].unit_price` | `int` | 单价（金币/个） |
| `depth[].total_amount` | `int` | 该价格档位的总数量 |
| `depth[].order_ids` | `int[]` | 该价格档位的订单 ID 列表 |
| `floor_price` | `int\|null` | 最低挂单价（地板价） |
| `my_orders[]` | `array` | 当前玩家的挂单列表 |

---

### 12. POST /api/market/sell

发布卖单，将物品挂到市场上出售。

#### Request Body

```json
{
  "item": "corn",
  "amount": 10,
  "unit_price": 5
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `item` | `string` | 是 | 物品类型 |
| `amount` | `int` | 是 | 数量，必须 > 0 |
| `unit_price` | `int` | 是 | 单价（金币/个），必须 > 0 |

#### Response `data` 结构

```json
{
  "order_id": 2,
  "status": "active"
}
```

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `2001` | 库存不足 | 玩家该物品库存 < `amount` |
| `2002` | 参数无效 | `amount` 或 `unit_price` <= 0 |

---

### 13. POST /api/market/buy

购买市场上某个活跃订单的物品。

#### Request Body

```json
{
  "order_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `order_id` | `int` | 是 | 订单 ID |

#### Response `data` 结构

```json
{
  "order_id": 1,
  "item": "corn",
  "amount": 10,
  "cost": 50,
  "gold_remaining": 85
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `gold_remaining` | `int` | 买家剩余金币 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `2101` | 订单不存在或已售出 | 订单 `status` 不是 `active` |
| `2102` | 不能购买自己的订单 | `seller_id` == 买家 ID |
| `2103` | 金币不足 | 买家 `gold` < `total_price` |

---

### 14. GET /api/market/companies

获取 NPC 企业列表及其当前收购价。

#### Request

无参数。

#### Response `data` 结构

```json
[
  {
    "company_id": "flour_mill",
    "name": "🏭 面粉厂",
    "emoji": "🏭",
    "description": "收购小麦，磨制面粉",
    "buy_item": "wheat",
    "buy_item_name": "小麦",
    "buy_item_emoji": "🌾",
    "buy_price": 4,
    "base_price": 3,
    "event": null
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `company_id` | `string` | 企业标识 |
| `name` | `string` | 企业名称 |
| `emoji` | `string` | 企业图标 |
| `buy_item` | `string` | 收购的作物类型 |
| `buy_price` | `int` | 当前收购价（动态波动） |
| `base_price` | `int` | 基础收购价 |
| `event` | `object\|null` | 宏观事件信息 |

---

### 15. POST /api/market/sell-to-company

向 NPC 企业直接出售作物（B2B 模式，系统保证成交）。

#### Request Body

```json
{
  "item": "wheat",
  "amount": 10
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `item` | `string` | 是 | 作物类型 |
| `amount` | `int` | 是 | 出售数量，必须 > 0 |

#### Response `data` 结构

```json
{
  "item": "wheat",
  "amount": 10,
  "unit_price": 4,
  "total_revenue": 40,
  "company_id": "flour_mill",
  "company_name": "面粉厂"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `item` | `string` | 出售的作物类型 |
| `amount` | `int` | 出售数量 |
| `unit_price` | `int` | 成交单价 |
| `total_revenue` | `int` | 总收入 |
| `company_id` | `string` | 企业 ID |
| `company_name` | `string` | 企业名称 |

#### 错误场景

| code | message | 说明 |
|------|---------|------|
| `3001` | 企业不存在 | `company_id` 无效 |
| `3002` | 该企业不收购此作物 | 物品类型不匹配 |
| `3003` | 库存不足 | 玩家该物品库存 < `amount` |

---

### 16. GET /api/leaderboard

获取双轨制净值排行榜。

> **MVP 6.0 新增**  
> 动态净值公式：`总净值 = 现金 + (地块数 × 1000) + ∑(每种作物库存 × 该作物当前企业收购价)`  
> 阶级划分：农夫新星榜 (≤6块地) vs 资本巨鳄榜 (>6块地)

#### Request

无参数。需携带 `Authorization: Bearer <token>`。

#### Response `data` 结构

```json
{
  "farmers": [
    {
      "rank": 1,
      "user_id": 3,
      "nickname": "商人大李",
      "gold": 200,
      "unlocked_plots": 6,
      "land_value": 6000,
      "inventory_value": 923,
      "net_worth": 7123
    }
  ],
  "capitalists": [
    {
      "rank": 1,
      "user_id": 10,
      "nickname": "资本大鳄",
      "gold": 50000,
      "unlocked_plots": 12,
      "land_value": 12000,
      "inventory_value": 15000,
      "net_worth": 77000
    }
  ],
  "updated_at": 1719200000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `farmers[]` | `array` | 农夫新星榜（≤6块地），按净值降序，前 50 名 |
| `capitalists[]` | `array` | 资本巨鳄榜（>6块地），按净值降序，前 50 名 |
| `updated_at` | `int` | 计算时间戳（毫秒） |

**每个条目字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `rank` | `int` | 排名（1-based） |
| `user_id` | `int` | 玩家 ID |
| `nickname` | `string` | 昵称 |
| `gold` | `int` | 现金 |
| `unlocked_plots` | `int` | 已解锁土地数 |
| `land_value` | `int` | 土地估值（地块数 × 1000） |
| `inventory_value` | `int` | 库存估值（∑ 库存 × 当前收购价） |
| `net_worth` | `int` | 总净值 |

---

## 错误码规范

| 范围 | 模块 | 说明 |
|------|------|------|
| `0` | - | 成功 |
| `1000~1099` | 农场-播种 | 播种相关错误 |
| `1100~1199` | 农场-收割 | 收割相关错误 |
| `1200~1299` | 农场-解锁 | 土地解锁相关错误 |
| `1300~1399` | 农场-打工牛 | 打工牛相关错误 |
| `1400~1499` | 农场-种子 | 种子购买相关错误 |
| `2000~2099` | 市场-挂单 | 发布卖单相关错误 |
| `2100~2199` | 市场-购买 | 购买相关错误 |
| `3000~3099` | 市场-企业 | NPC 企业交易相关错误 |
| `4000~4099` | 认证 | JWT 认证相关错误 |
| `5000~5099` | 地租-清算 | 地租结算/破产清算相关错误 |
| `9000~9999` | 通用 | 系统级错误（参数校验等） |

### 通用错误

```json
{
  "code": 9001,
  "message": "参数校验失败",
  "data": {
    "errors": [
      { "field": "plot_id", "message": "plot_id 必须为正整数" }
    ]
  }
}
```

```json
{
  "code": 4002,
  "message": "凭证已过期或无效，请重新登录"
}
```
