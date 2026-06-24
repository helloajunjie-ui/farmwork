# 数据库设计文档 (PostgreSQL)

> **引擎**: PostgreSQL 14+  
> **字符集**: `UTF8`  
> **事务隔离级别**: `READ COMMITTED` (默认)

---

## 核心设计原则

1. **服务器时间为唯一真理** — 所有生长/成熟判定基于 `NOW()`，不信任客户端时间
2. **ACID 事务保证资产安全** — 库存扣减、金币转移必须在事务中完成
3. **行级锁防并发** — 市场购买使用 `SELECT ... FOR UPDATE`
4. **O(1) 离线结算** — 打工牛 + 地租均使用时间差公式，零 cron 开销
5. **预留扩展字段** — `avatar_url`、`icon_url` 等初期为 `NULL`，后期无缝接入

---

## 表结构

### 1. `users` — 玩家表

```sql
CREATE TABLE users (
    user_id       SERIAL       PRIMARY KEY,
    nickname      VARCHAR(32)  NOT NULL DEFAULT '',
    gold          INT          NOT NULL DEFAULT 100 CHECK (gold >= 0),
    avatar_url    VARCHAR(512) DEFAULT NULL,   -- 预留：头像 URL
    upkeep_rate   FLOAT        NOT NULL DEFAULT 0,   -- 地租费率 (🪙/min)
    last_upkeep_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 上次地租结算时间
    is_bankrupt   BOOLEAN      NOT NULL DEFAULT FALSE, -- 是否破产
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN users.gold IS '金币，不可为负数';
COMMENT ON COLUMN users.avatar_url IS '预留字段，后期接入对象存储后使用';
COMMENT ON COLUMN users.upkeep_rate IS '地租费率，根据已解锁土地数动态计算';
COMMENT ON COLUMN users.last_upkeep_at IS '上次地租结算时间戳，用于 O(1) 时间差结算';
COMMENT ON COLUMN users.is_bankrupt IS '是否处于破产清算状态';
```

### 2. `inventory` — 物品库存表

```sql
CREATE TABLE inventory (
    user_id INT         NOT NULL REFERENCES users(user_id),
    item    VARCHAR(32) NOT NULL,           -- 物品名，如 'corn', 'seed', 'wheat', 'hops'
    amount  INT         NOT NULL DEFAULT 0 CHECK (amount >= 0),
    PRIMARY KEY (user_id, item)
);

COMMENT ON COLUMN inventory.item IS '物品标识符，小写英文';
COMMENT ON COLUMN inventory.amount IS '持有数量，不可为负数';
```

> **为什么不用 JSON 字段存所有物品？**  
> 关系型设计便于后续扩展（物品类型增加、查询排序、事务锁定粒度更细）。

### 3. `plots` — 土地表

```sql
CREATE TABLE plots (
    plot_id      INT          NOT NULL,       -- 土地编号 (1~N)
    user_id      INT          NOT NULL REFERENCES users(user_id),
    status       VARCHAR(16)  NOT NULL DEFAULT 'idle'
                   CHECK (status IN ('locked', 'idle', 'growing', 'ready')),
    planted_at   TIMESTAMPTZ  DEFAULT NULL,   -- 播种时间戳，NULL=空闲
    crop         VARCHAR(32)  DEFAULT NULL,   -- 作物类型：'wheat', 'corn', 'hops'
    unlock_price INT          DEFAULT NULL,   -- 解锁所需金币，locked 时有效
    PRIMARY KEY (plot_id, user_id)
);

CREATE INDEX idx_plots_user_id ON plots(user_id);

COMMENT ON COLUMN plots.status IS 'locked=锁定 idle=空闲 growing=生长中 ready=已成熟';
COMMENT ON COLUMN plots.planted_at IS '播种时的服务器时间戳，NULL 表示空地';
COMMENT ON COLUMN plots.crop IS '作物类型，planted_at 为 NULL 时此字段无意义';
COMMENT ON COLUMN plots.unlock_price IS '解锁该土地所需金币，仅 status=locked 时有值';
```

> **生长判定逻辑（后端）**：
> ```sql
> -- 成熟判定（以玉米 28min 为例）
> SELECT (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM planted_at)) >= 1680 AS is_ready
> FROM plots WHERE plot_id = $1 AND user_id = $2;
> ```
>
> **生长周期**：
> - 🌾 小麦: 600 秒 (10 min)
> - 🌽 玉米: 1680 秒 (28 min)
> - 🍺 啤酒花: 3600 秒 (60 min)

### 4. `cows` — 打工牛表

```sql
CREATE TABLE cows (
    user_id      INT          PRIMARY KEY REFERENCES users(user_id),
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cows IS '打工牛，每人最多一头，提供离线自动化';
COMMENT ON COLUMN cows.last_sync_at IS '上次同步时间戳，用于 O(1) 离线结算';
```

> **O(1) 离线结算公式**：
> ```
> elapsed = NOW() - last_sync_at
> cycles  = floor(elapsed / GROW_DURATION)
> actual  = min(cycles, floor(available_seeds / planted_plots_count))
> ```

### 5. `market_orders` — 市场订单表

```sql
CREATE TABLE market_orders (
    id          SERIAL       PRIMARY KEY,
    seller_id   INT          NOT NULL REFERENCES users(user_id),
    item        VARCHAR(32)  NOT NULL,
    amount      INT          NOT NULL CHECK (amount > 0),
    unit_price  INT          NOT NULL CHECK (unit_price > 0),  -- 单价
    total_price INT          NOT NULL CHECK (total_price > 0), -- 总价 = amount * unit_price
    status      VARCHAR(16)  NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'sold', 'cancelled')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_orders_status ON market_orders(status);
CREATE INDEX idx_market_orders_seller ON market_orders(seller_id);
CREATE INDEX idx_market_orders_item_price ON market_orders(item, unit_price);

COMMENT ON COLUMN market_orders.status IS 'active=挂单中, sold=已售出, cancelled=已取消';
COMMENT ON COLUMN market_orders.unit_price IS '单价（金币/个），MVP 2.0 新增';
COMMENT ON COLUMN market_orders.total_price IS '总价 = amount × unit_price';
```

### 6. `market_environment` — 宏观环境表 (MVP 3.0)

```sql
CREATE TABLE market_environment (
    crop_id           VARCHAR(32)  PRIMARY KEY,
    buy_price         INT          NOT NULL,        -- 当前企业收购价
    seed_target_price INT          NOT NULL,        -- 种子目标价（相位延迟用）
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE market_environment IS '宏观市场环境，记录每种作物的当前价格';
COMMENT ON COLUMN market_environment.buy_price IS '当前企业收购价（动态波动）';
COMMENT ON COLUMN market_environment.seed_target_price IS '种子目标价，用于相位延迟计算';
```

### 7. `market_events` — 宏观事件表 (MVP 3.0)

```sql
CREATE TABLE market_events (
    id             SERIAL       PRIMARY KEY,
    crop_id        VARCHAR(32)  NOT NULL,
    event_type     VARCHAR(32)  NOT NULL,        -- 'drought', 'festival', 'scandal', etc.
    title          VARCHAR(128) NOT NULL,        -- 事件标题
    description    TEXT         DEFAULT NULL,    -- 事件描述
    price_modifier FLOAT        NOT NULL,        -- 价格修正系数 (±0.3 = ±30%)
    expires_at     TIMESTAMPTZ  NOT NULL,        -- 事件过期时间
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_events_crop ON market_events(crop_id);
CREATE INDEX idx_market_events_expires ON market_events(expires_at);

COMMENT ON TABLE market_events IS '宏观事件，临时影响作物价格';
COMMENT ON COLUMN market_events.price_modifier IS '价格修正系数，1.3 = +30%, 0.7 = -30%';
```

---

## 初始化数据

```sql
-- 插入测试玩家
INSERT INTO users (user_id, nickname, gold) VALUES
(1, '青羽',    100),
(2, '农民小王', 50),
(3, '商人大李', 200);

-- 初始化库存（多作物）
INSERT INTO inventory (user_id, item, amount) VALUES
(1, 'seed', 10), (1, 'corn', 0), (1, 'wheat', 0), (1, 'hops', 0),
(2, 'seed', 5),  (2, 'corn', 20), (2, 'wheat', 5), (2, 'hops', 0),
(3, 'seed', 3),  (3, 'corn', 5), (3, 'wheat', 10), (3, 'hops', 2);

-- 初始化土地（每人 12 块地：前 6 块空闲，后 6 块锁定）
INSERT INTO plots (plot_id, user_id, status, planted_at, crop, unlock_price)
SELECT n, u.user_id,
       CASE WHEN n <= 6 THEN 'idle' ELSE 'locked' END,
       NULL, NULL,
       CASE
         WHEN n = 7  THEN 100
         WHEN n = 8  THEN 500
         WHEN n = 9  THEN 2000
         WHEN n = 10 THEN 8000
         WHEN n = 11 THEN 32000
         WHEN n = 12 THEN 128000
         ELSE NULL
       END
FROM (SELECT generate_series(1, 12) AS n) AS nums
CROSS JOIN (SELECT user_id FROM users) AS u;

-- 初始化宏观环境
INSERT INTO market_environment (crop_id, buy_price, seed_target_price) VALUES
('wheat', 3, 2),
('corn', 6, 4),
('hops', 15, 10);
```

---

## 关键事务 SQL

### 播种事务

```sql
BEGIN;

-- 1. 校验土地是否空闲
SELECT planted_at FROM plots
WHERE plot_id = $1 AND user_id = $2
FOR UPDATE;

-- 如果 status != 'idle' → ROLLBACK (code: 1001)

-- 2. 扣减种子
UPDATE inventory SET amount = amount - 1
WHERE user_id = $2 AND item = 'seed' AND amount >= 1;

-- 如果影响行数 = 0 → ROLLBACK (code: 1002)

-- 3. 更新土地状态
UPDATE plots SET planted_at = NOW(), crop = $3, status = 'growing'
WHERE plot_id = $1 AND user_id = $2;

COMMIT;
```

### 收割事务

```sql
BEGIN;

-- 1. 锁定土地行
SELECT planted_at, crop FROM plots
WHERE plot_id = $1 AND user_id = $2
FOR UPDATE;

-- 如果 planted_at IS NULL → ROLLBACK (code: 1101)
-- 如果 (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM planted_at)) < 生长周期 → ROLLBACK (code: 1102)

-- 2. 增加对应作物库存（固定收获 3 个）
UPDATE inventory SET amount = amount + 3
WHERE user_id = $2 AND item = (SELECT crop FROM plots WHERE plot_id = $1 AND user_id = $2);

-- 3. 重置土地
UPDATE plots SET planted_at = NULL, crop = NULL, status = 'idle'
WHERE plot_id = $1 AND user_id = $2;

COMMIT;
```

### 解锁土地事务

```sql
BEGIN;

-- 1. 锁定土地行
SELECT status, unlock_price FROM plots
WHERE plot_id = $1 AND user_id = $2
FOR UPDATE;

-- 如果 status != 'locked' → ROLLBACK (code: 1201)
-- 如果 unlock_price IS NULL → ROLLBACK (code: 1202)

-- 2. 锁定玩家金币
SELECT gold FROM users WHERE user_id = $2 FOR UPDATE;

-- 如果 gold < unlock_price → ROLLBACK (code: 1203)

-- 3. 扣金币
UPDATE users SET gold = gold - unlock_price WHERE user_id = $2;

-- 4. 解锁土地
UPDATE plots SET status = 'idle', unlock_price = NULL
WHERE plot_id = $1 AND user_id = $2;

COMMIT;
```

### 挂单事务（冻结库存）

```sql
BEGIN;

-- 1. 锁定玩家库存行
SELECT amount FROM inventory
WHERE user_id = $1 AND item = $2
FOR UPDATE;

-- 如果 amount < $3 → ROLLBACK (code: 2001)

-- 2. 扣减库存（冻结）
UPDATE inventory SET amount = amount - $3
WHERE user_id = $1 AND item = $2;

-- 3. 创建订单（含 unit_price）
INSERT INTO market_orders (seller_id, item, amount, unit_price, total_price)
VALUES ($1, $2, $3, $4, $3 * $4);

COMMIT;
```

### 购买事务（行级锁防并发）

```sql
BEGIN;

-- 1. 锁定订单行（关键！防止并发购买）
SELECT id, seller_id, item, amount, total_price, status
FROM market_orders
WHERE id = $1
FOR UPDATE;

-- 如果 status != 'active' → ROLLBACK (code: 2101)
-- 如果 seller_id = 买家ID → ROLLBACK (code: 2102)

-- 2. 锁定买家金币
SELECT gold FROM users
WHERE user_id = $2
FOR UPDATE;

-- 如果 gold < total_price → ROLLBACK (code: 2103)

-- 3. 扣买家金币
UPDATE users SET gold = gold - $total_price
WHERE user_id = $2;

-- 4. 加卖家金币
UPDATE users SET gold = gold + $total_price
WHERE user_id = $seller_id;

-- 5. 给买家加物品
UPDATE inventory SET amount = amount + $amount
WHERE user_id = $2 AND item = $item;

-- 6. 更新订单状态
UPDATE market_orders SET status = 'sold', updated_at = NOW()
WHERE id = $1;

COMMIT;
```

### 向企业出售事务 (MVP 3.0)

```sql
BEGIN;

-- 1. 锁定玩家库存
SELECT amount FROM inventory
WHERE user_id = $1 AND item = $2
FOR UPDATE;

-- 如果 amount < $3 → ROLLBACK (code: 3003)

-- 2. 扣减库存
UPDATE inventory SET amount = amount - $3
WHERE user_id = $1 AND item = $2;

-- 3. 加金币（按当前收购价）
UPDATE users SET gold = gold + ($3 * $4)
WHERE user_id = $1;

COMMIT;
```

### 地租结算 (MVP 4.0)

```sql
-- 计算地租费率
-- rate = (unlocked_plots - 10)² × 0.5, 当 unlocked_plots > 10 时

-- 时间差结算
-- elapsed_minutes = MIN(60, EXTRACT(EPOCH FROM NOW() - last_upkeep_at) / 60)
-- total_upkeep = CEIL(elapsed_minutes * upkeep_rate)

-- 扣减金币
UPDATE users SET
  gold = GREATEST(0, gold - total_upkeep),
  last_upkeep_at = NOW()
WHERE user_id = $1;

-- 如果 gold < total_upkeep，触发清算：
-- 从最大 plot_id 开始锁定土地，每块返还 5 金币
-- 直到 gold >= 0
```
