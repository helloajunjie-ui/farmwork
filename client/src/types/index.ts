// ===== 通用响应结构 =====
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// ===== 资金链健康度 =====
export interface UpkeepInfo {
  rate: number           // 每分钟地租
  minutes_remaining: number // 余额可支撑分钟数
  unlocked_plots: number // 已解锁土地数
  is_bankrupt: boolean   // 是否破产
}

// ===== 玩家 =====
export interface UserInfo {
  user_id: number
  nickname: string
  gold: number
  items: Record<string, number>
  avatar_url: string | null
  upkeep?: UpkeepInfo    // MVP 4.0: 资金链健康度
}

// ===== 农场 =====
export type PlotStatus = 'locked' | 'idle' | 'growing' | 'ready'

export interface Plot {
  plot_id: number
  status: PlotStatus
  planted_at: number | null
  crop: string | null
  remaining_seconds: number
  unlock_price: number | null
}

export interface PlantRequest {
  plot_id: number
  crop: string
}

export interface HarvestRequest {
  plot_id: number
}

export interface HarvestResponse {
  plot_id: number
  status: 'idle'
  harvested: number
  items: Record<string, number>
}

export interface UnlockResponse {
  plot_id: number
  status: 'idle'
  cost: number
}

export interface CowStatus {
  has_cow: boolean
  active: boolean
  last_sync_at: number | null
}

// ===== 作物分类 (MVP 4.1) =====
export type CropCategory = 'grain' | 'vegetable' | 'fruit' | 'cash' | 'herb'

export const CATEGORY_LABELS: Record<CropCategory, string> = {
  grain: '🌾 谷物薯类',
  vegetable: '🥬 日常蔬菜',
  fruit: '🍎 水果类',
  cash: '💰 经济作物',
  herb: '🌿 珍稀草药',
}

export const CATEGORY_ORDER: CropCategory[] = ['grain', 'vegetable', 'fruit', 'cash', 'herb']

// 作物基础信息（用于种子站展示）
export interface CropInfo {
  id: string
  name: string
  emoji: string
  category: CropCategory
  totalTimeMin: number
  yield: number
  baseSeedPrice: number
  baseSellPrice: number
  companyId: string
  companyName: string
  companyEmoji: string
  profitMargin: number
}

// ===== 市场 =====

// 盘口深度条目（按单价聚合）
export interface DepthItem {
  unit_price: number
  total_amount: number
  order_ids: number[]
}

// 我的挂单
export interface MyOrder {
  id: number
  unit_price: number
  amount: number
  total_price: number
  created_at: number
}

// 盘口数据响应
export interface OrderBookData {
  depth: DepthItem[]
  floor_price: number | null
  my_orders: MyOrder[]
}

export interface MarketOrder {
  id: number
  seller_id: number
  seller_name: string
  item: string
  amount: number
  total_price: number
  created_at: number
}

export interface SellRequest {
  item: string
  amount: number
  unit_price: number
}

export interface BuyRequest {
  order_id: number
}

export interface BuyResponse {
  order_id: number
  item: string
  amount: number
  cost: number
  gold_remaining: number
}

// ===== 系统商店 =====
export interface BuySeedRequest {
  amount: number
  crop?: string
}

export interface BuySeedResponse {
  amount: number
  cost: number
  price_per_unit: number
  crop: string
}

// ===== 企业（系统买家） =====
export interface CompanyInfo {
  company_id: string
  name: string
  emoji: string
  description: string
  buy_item: string
  buy_item_name: string
  buy_item_emoji: string
  buy_price: number
  base_price: number
  event: {
    title: string
    multiplier: number
  } | null
}

// ===== 宏观事件 =====
export interface MarketEvent {
  id: number
  event_type: string
  title: string
  crop_id: string
  multiplier: number
  started_at: number
  expires_at: number
}

// ===== 企业直售响应 =====
export interface SellToCompanyResponse {
  item: string
  amount: number
  unit_price: number
  total_revenue: number
  company_id: string
  company_name: string
}

// ===== MVP 6.0: 排行榜 =====
export interface LeaderboardEntry {
  rank: number
  user_id: number
  nickname: string
  gold: number
  unlocked_plots: number
  land_value: number
  inventory_value: number
  net_worth: number
}

export interface LeaderboardData {
  farmers: LeaderboardEntry[]
  capitalists: LeaderboardEntry[]
  updated_at: number
}
