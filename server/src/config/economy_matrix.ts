// ===== 造物主公式：产业链经济矩阵 (MVP 4.1) =====
// 设计哲学：
//   - 时间梯度：短周期(3~10min) / 中周期(15~45min) / 长周期(60~360min)
//   - 三段生命周期：出苗期(20%) + 成长期(40%) + 成熟期(40%)
//   - 利润率公式：利润率 = (yield * baseSellPrice - baseSeedPrice) / baseSeedPrice
//     → 短周期 50~100%，中周期 100~200%，长周期 200~500%
//   - 种子价格指数增长：baseSeedPrice ∝ totalTime^1.5
//   - 收购价 = baseSeedPrice * 利润率因子 / yield

// ===== 1. 收购企业矩阵 (10 家) =====
export interface CompanyConfig {
  id: string
  name: string
  emoji: string
  category: 'basic' | 'light' | 'high_value'
  basePrice: number        // 基准收购价
  buyItem: string          // 收购的作物 ID
  description: string
}

export const COMPANIES: Record<string, CompanyConfig> = {
  // ===== 基础类 (Basic) =====
  flour_mill: {
    id: 'flour_mill', name: '红星面粉厂', emoji: '🏭', category: 'basic',
    basePrice: 3, buyItem: 'wheat', description: '每日新鲜研磨，大量收购优质小麦',
  },
  power_plant: {
    id: 'power_plant', name: '城市热电厂', emoji: '⚡', category: 'basic',
    basePrice: 3, buyItem: 'corn', description: '生物质发电，长期稳定采购玉米',
  },
  feed_factory: {
    id: 'feed_factory', name: '全民饲料厂', emoji: '🌾', category: 'basic',
    basePrice: 2, buyItem: 'sorghum', description: '畜禽饲料原料，大量收购高粱和谷物',
  },
  supermarket: {
    id: 'supermarket', name: '大润发连锁超市', emoji: '🛒', category: 'basic',
    basePrice: 4, buyItem: 'cabbage', description: '生鲜区直采，每日需要大量新鲜蔬菜',
  },
  // ===== 轻工类 (Light) =====
  textile_mill: {
    id: 'textile_mill', name: '第一纺织厂', emoji: '🧵', category: 'light',
    basePrice: 5, buyItem: 'cotton', description: '棉纺生产线，高价收购优质棉花',
  },
  sugar_group: {
    id: 'sugar_group', name: '东方糖业集团', emoji: '🍬', category: 'light',
    basePrice: 6, buyItem: 'sugar_beet', description: '制糖原料，长期合同收购甜菜',
  },
  brewery: {
    id: 'brewery', name: '精酿啤酒厂', emoji: '🍺', category: 'light',
    basePrice: 8, buyItem: 'hops', description: '精酿啤酒源头，高价收购优质啤酒花',
  },
  juice_factory: {
    id: 'juice_factory', name: '鲜榨果汁加工厂', emoji: '🧃', category: 'light',
    basePrice: 7, buyItem: 'apple', description: 'NFC果汁生产线，大量采购新鲜水果',
  },
  // ===== 高附加值类 (High Value) =====
  pharma_group: {
    id: 'pharma_group', name: '联合制药集团', emoji: '💊', category: 'high_value',
    basePrice: 20, buyItem: 'ginseng', description: '中药提取线，高价收购珍稀药材',
  },
  spice_house: {
    id: 'spice_house', name: '皇家香料行', emoji: '🌶️', category: 'high_value',
    basePrice: 15, buyItem: 'saffron', description: '顶级香料供应商，全球采购珍稀香料',
  },
}

export const COMPANY_IDS = Object.keys(COMPANIES)

export function isValidCompany(id: string): boolean {
  return id in COMPANIES
}

// ===== 2. 作物分类枚举 =====
export type CropCategory = 'grain' | 'vegetable' | 'fruit' | 'cash' | 'herb'

export const CATEGORY_LABELS: Record<CropCategory, string> = {
  grain: '🌾 谷物薯类',
  vegetable: '🥬 日常蔬菜',
  fruit: '🍎 水果类',
  cash: '💰 经济作物',
  herb: '🌿 珍稀草药',
}

// ===== 3. 生长阶段 =====
export interface GrowthStage {
  name: string
  ratio: number
}

export const STAGES: GrowthStage[] = [
  { name: '出苗期', ratio: 0.2 },
  { name: '成长期', ratio: 0.4 },
  { name: '成熟期', ratio: 0.4 },
]

// ===== 4. 作物配置接口 =====
export interface CropConfig {
  id: string
  name: string
  emoji: string
  category: CropCategory
  totalTimeMin: number       // 总生长时间（分钟）
  yield: number              // 单次产出数量
  baseSeedPrice: number      // 基础种子价格
  baseSellPrice: number      // 基础收购价（企业基准价）
  companyId: string          // 对口企业 ID
  // 向后兼容字段
  growDuration: number       // = totalTimeMin * 60
  yieldPerPlot: number       // = yield
  seedPrice: number          // = baseSeedPrice
}

// ===== 5. 40 种农作物完整配置 =====
// 数学约束：
//   - baseSellPrice * yield > baseSeedPrice（必须盈利）
//   - 利润率 = (yield * baseSellPrice - baseSeedPrice) / baseSeedPrice
//   - 短周期(3~10min): 利润率 50~100%
//   - 中周期(15~45min): 利润率 100~200%
//   - 长周期(60~360min): 利润率 200~500%
//   - baseSeedPrice ∝ totalTimeMin^1.5（指数增长）

function crop(c: Omit<CropConfig, 'growDuration' | 'yieldPerPlot' | 'seedPrice'>): CropConfig {
  return {
    ...c,
    growDuration: c.totalTimeMin * 60,
    yieldPerPlot: c.yield,
    seedPrice: c.baseSeedPrice,
  }
}

export const CROPS: Record<string, CropConfig> = {
  // ===== 🌾 谷物薯类 (8种) =====
  wheat: crop({ id: 'wheat', name: '小麦', emoji: '🌾', category: 'grain', totalTimeMin: 10, yield: 4, baseSeedPrice: 2, baseSellPrice: 3, companyId: 'flour_mill' }),
  corn: crop({ id: 'corn', name: '玉米', emoji: '🌽', category: 'grain', totalTimeMin: 28, yield: 3, baseSeedPrice: 4, baseSellPrice: 6, companyId: 'power_plant' }),
  rice: crop({ id: 'rice', name: '水稻', emoji: '🍚', category: 'grain', totalTimeMin: 35, yield: 3, baseSeedPrice: 5, baseSellPrice: 8, companyId: 'brewery' }),
  sorghum: crop({ id: 'sorghum', name: '高粱', emoji: '🌾', category: 'grain', totalTimeMin: 20, yield: 4, baseSeedPrice: 2, baseSellPrice: 3, companyId: 'feed_factory' }),
  potato: crop({ id: 'potato', name: '土豆', emoji: '🥔', category: 'grain', totalTimeMin: 15, yield: 5, baseSeedPrice: 3, baseSellPrice: 3, companyId: 'supermarket' }),
  sweet_potato: crop({ id: 'sweet_potato', name: '红薯', emoji: '🍠', category: 'grain', totalTimeMin: 18, yield: 5, baseSeedPrice: 3, baseSellPrice: 3, companyId: 'feed_factory' }),
  oat: crop({ id: 'oat', name: '燕麦', emoji: '🌾', category: 'grain', totalTimeMin: 12, yield: 4, baseSeedPrice: 2, baseSellPrice: 3, companyId: 'flour_mill' }),
  barley: crop({ id: 'barley', name: '大麦', emoji: '🌾', category: 'grain', totalTimeMin: 25, yield: 3, baseSeedPrice: 4, baseSellPrice: 6, companyId: 'brewery' }),
  hops: crop({ id: 'hops', name: '啤酒花', emoji: '🍺', category: 'cash', totalTimeMin: 45, yield: 3, baseSeedPrice: 8, baseSellPrice: 14, companyId: 'brewery' }),

  // ===== 🥬 日常蔬菜 (8种) =====
  cabbage: crop({ id: 'cabbage', name: '白菜', emoji: '🥬', category: 'vegetable', totalTimeMin: 8, yield: 5, baseSeedPrice: 2, baseSellPrice: 2, companyId: 'supermarket' }),
  tomato: crop({ id: 'tomato', name: '番茄', emoji: '🍅', category: 'vegetable', totalTimeMin: 15, yield: 4, baseSeedPrice: 3, baseSellPrice: 4, companyId: 'supermarket' }),
  cucumber: crop({ id: 'cucumber', name: '黄瓜', emoji: '🥒', category: 'vegetable', totalTimeMin: 10, yield: 4, baseSeedPrice: 2, baseSellPrice: 3, companyId: 'supermarket' }),
  garlic: crop({ id: 'garlic', name: '大蒜', emoji: '🧄', category: 'vegetable', totalTimeMin: 30, yield: 3, baseSeedPrice: 5, baseSellPrice: 8, companyId: 'supermarket' }),
  ginger: crop({ id: 'ginger', name: '生姜', emoji: '🫚', category: 'vegetable', totalTimeMin: 35, yield: 3, baseSeedPrice: 6, baseSellPrice: 10, companyId: 'supermarket' }),
  carrot: crop({ id: 'carrot', name: '胡萝卜', emoji: '🥕', category: 'vegetable', totalTimeMin: 12, yield: 4, baseSeedPrice: 2, baseSellPrice: 3, companyId: 'supermarket' }),
  onion: crop({ id: 'onion', name: '洋葱', emoji: '🧅', category: 'vegetable', totalTimeMin: 22, yield: 4, baseSeedPrice: 3, baseSellPrice: 4, companyId: 'supermarket' }),
  chili: crop({ id: 'chili', name: '辣椒', emoji: '🌶️', category: 'vegetable', totalTimeMin: 20, yield: 4, baseSeedPrice: 3, baseSellPrice: 5, companyId: 'supermarket' }),

  // ===== 🍎 水果类 (8种) =====
  apple: crop({ id: 'apple', name: '苹果', emoji: '🍎', category: 'fruit', totalTimeMin: 40, yield: 3, baseSeedPrice: 6, baseSellPrice: 10, companyId: 'juice_factory' }),
  grape: crop({ id: 'grape', name: '葡萄', emoji: '🍇', category: 'fruit', totalTimeMin: 50, yield: 3, baseSeedPrice: 8, baseSellPrice: 14, companyId: 'juice_factory' }),
  strawberry: crop({ id: 'strawberry', name: '草莓', emoji: '🍓', category: 'fruit', totalTimeMin: 30, yield: 4, baseSeedPrice: 5, baseSellPrice: 8, companyId: 'juice_factory' }),
  orange: crop({ id: 'orange', name: '柑橘', emoji: '🍊', category: 'fruit', totalTimeMin: 45, yield: 3, baseSeedPrice: 7, baseSellPrice: 12, companyId: 'juice_factory' }),
  peach: crop({ id: 'peach', name: '水蜜桃', emoji: '🍑', category: 'fruit', totalTimeMin: 55, yield: 2, baseSeedPrice: 10, baseSellPrice: 20, companyId: 'juice_factory' }),
  pear: crop({ id: 'pear', name: '梨', emoji: '🍐', category: 'fruit', totalTimeMin: 35, yield: 3, baseSeedPrice: 5, baseSellPrice: 9, companyId: 'juice_factory' }),
  cherry: crop({ id: 'cherry', name: '樱桃', emoji: '🍒', category: 'fruit', totalTimeMin: 60, yield: 2, baseSeedPrice: 12, baseSellPrice: 25, companyId: 'supermarket' }),
  watermelon: crop({ id: 'watermelon', name: '西瓜', emoji: '🍉', category: 'fruit', totalTimeMin: 45, yield: 2, baseSeedPrice: 8, baseSellPrice: 18, companyId: 'supermarket' }),

  // ===== 💰 经济作物 (8种) =====
  cotton: crop({ id: 'cotton', name: '棉花', emoji: '☁️', category: 'cash', totalTimeMin: 50, yield: 3, baseSeedPrice: 8, baseSellPrice: 14, companyId: 'textile_mill' }),
  sugar_beet: crop({ id: 'sugar_beet', name: '甜菜', emoji: '🍬', category: 'cash', totalTimeMin: 40, yield: 4, baseSeedPrice: 6, baseSellPrice: 10, companyId: 'sugar_group' }),
  tobacco: crop({ id: 'tobacco', name: '烟叶', emoji: '🚬', category: 'cash', totalTimeMin: 70, yield: 2, baseSeedPrice: 15, baseSellPrice: 35, companyId: 'spice_house' }),
  soybean: crop({ id: 'soybean', name: '大豆', emoji: '🫘', category: 'cash', totalTimeMin: 30, yield: 3, baseSeedPrice: 5, baseSellPrice: 9, companyId: 'feed_factory' }),
  peanut: crop({ id: 'peanut', name: '花生', emoji: '🥜', category: 'cash', totalTimeMin: 35, yield: 3, baseSeedPrice: 6, baseSellPrice: 11, companyId: 'sugar_group' }),
  tea: crop({ id: 'tea', name: '茶叶', emoji: '🍵', category: 'cash', totalTimeMin: 60, yield: 2, baseSeedPrice: 12, baseSellPrice: 28, companyId: 'spice_house' }),
  coffee: crop({ id: 'coffee', name: '咖啡豆', emoji: '☕', category: 'cash', totalTimeMin: 80, yield: 2, baseSeedPrice: 18, baseSellPrice: 40, companyId: 'spice_house' }),
  hemp: crop({ id: 'hemp', name: '工业大麻', emoji: '🌿', category: 'cash', totalTimeMin: 45, yield: 3, baseSeedPrice: 7, baseSellPrice: 13, companyId: 'textile_mill' }),

  // ===== 🌿 珍稀草药/香料 (8种) =====
  ginseng: crop({ id: 'ginseng', name: '人参', emoji: '🌱', category: 'herb', totalTimeMin: 180, yield: 1, baseSeedPrice: 50, baseSellPrice: 120, companyId: 'pharma_group' }),
  saffron: crop({ id: 'saffron', name: '藏红花', emoji: '🌸', category: 'herb', totalTimeMin: 240, yield: 1, baseSeedPrice: 80, baseSellPrice: 200, companyId: 'spice_house' }),
  ganoderma: crop({ id: 'ganoderma', name: '灵芝', emoji: '🍄', category: 'herb', totalTimeMin: 300, yield: 1, baseSeedPrice: 120, baseSellPrice: 300, companyId: 'pharma_group' }),
  cordyceps: crop({ id: 'cordyceps', name: '冬虫夏草', emoji: '🐛', category: 'herb', totalTimeMin: 360, yield: 1, baseSeedPrice: 200, baseSellPrice: 500, companyId: 'pharma_group' }),
  aloe: crop({ id: 'aloe', name: '芦荟', emoji: '🌵', category: 'herb', totalTimeMin: 60, yield: 3, baseSeedPrice: 10, baseSellPrice: 18, companyId: 'pharma_group' }),
  mint: crop({ id: 'mint', name: '薄荷', emoji: '🌿', category: 'herb', totalTimeMin: 15, yield: 5, baseSeedPrice: 3, baseSellPrice: 4, companyId: 'pharma_group' }),
  lavender: crop({ id: 'lavender', name: '薰衣草', emoji: '💜', category: 'herb', totalTimeMin: 45, yield: 3, baseSeedPrice: 8, baseSellPrice: 15, companyId: 'spice_house' }),
  angelica: crop({ id: 'angelica', name: '当归', emoji: '🌿', category: 'herb', totalTimeMin: 120, yield: 2, baseSeedPrice: 25, baseSellPrice: 55, companyId: 'pharma_group' }),
}

// ===== 6. 辅助函数 =====

export const CROP_IDS = Object.keys(CROPS)

export function isValidCrop(id: string): boolean {
  return id in CROPS
}

/** 获取某个分类下的所有作物 */
export function getCropsByCategory(category: CropCategory): CropConfig[] {
  return Object.values(CROPS).filter((c) => c.category === category)
}

/** 获取某个企业的对口作物 */
export function getCropByCompany(companyId: string): CropConfig | undefined {
  return Object.values(CROPS).find((c) => c.companyId === companyId)
}

/** 计算三段生长周期（秒） */
export function calcStages(totalTimeMin: number): { seedling: number; growing: number; mature: number } {
  const totalSec = totalTimeMin * 60
  return {
    seedling: Math.round(totalSec * 0.2),
    growing: Math.round(totalSec * 0.4),
    mature: Math.round(totalSec * 0.4),
  }
}

/** 计算利润率 */
export function calcProfitMargin(crop: CropConfig): number {
  const revenue = crop.yield * crop.baseSellPrice
  return (revenue - crop.baseSeedPrice) / crop.baseSeedPrice
}

/** 获取所有作物 ID 按分类分组 */
export function getCropIdsByCategory(): Record<CropCategory, string[]> {
  const result: Record<string, string[]> = { grain: [], vegetable: [], fruit: [], cash: [], herb: [] }
  for (const c of Object.values(CROPS)) {
    result[c.category].push(c.id)
  }
  return result as Record<CropCategory, string[]>
}
