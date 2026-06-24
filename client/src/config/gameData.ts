// ===== 全局数据字典 (Game Data) — 单点真理源 =====
// 设计哲学：
//   所有 UI 组件和业务逻辑都是"哑巴"（Dumb），只根据此字典渲染和计算。
//   添加第 41 种作物 / 第 11 家企业，只需在此文件加一行配置，核心代码零改动。
//   若要将"农场"换皮为"火星矿场"，只需重写此文件。

import type { CropCategory } from '../types'

// ===== 1. 分类定义 =====
export const CATEGORY_ORDER: CropCategory[] = ['grain', 'vegetable', 'fruit', 'cash', 'herb']

export const CATEGORY_LABELS: Record<CropCategory, string> = {
  grain: '🌾 谷物薯类',
  vegetable: '🥬 日常蔬菜',
  fruit: '🍎 水果类',
  cash: '💰 经济作物',
  herb: '🌿 珍稀草药',
}

// ===== 2. 企业配置 =====
export interface CompanyConfig {
  id: string
  name: string
  emoji: string
  description: string
  buyItem: string       // 对口收购的作物 ID
  basePrice: number     // 基准收购价
}

export const COMPANIES: Record<string, CompanyConfig> = {
  flour_mill:   { id: 'flour_mill',   name: '红星面粉厂',     emoji: '🏭', description: '每日新鲜研磨，大量收购优质小麦',       buyItem: 'wheat',      basePrice: 3 },
  power_plant:  { id: 'power_plant',  name: '城市热电厂',     emoji: '⚡', description: '生物质发电，长期稳定采购玉米',         buyItem: 'corn',       basePrice: 3 },
  feed_factory: { id: 'feed_factory', name: '全民饲料厂',     emoji: '🌾', description: '畜禽饲料原料，大量收购高粱和谷物',     buyItem: 'sorghum',    basePrice: 2 },
  supermarket:  { id: 'supermarket',  name: '大润发连锁超市', emoji: '🛒', description: '生鲜区直采，每日需要大量新鲜蔬菜',     buyItem: 'cabbage',    basePrice: 4 },
  textile_mill: { id: 'textile_mill', name: '第一纺织厂',     emoji: '🧵', description: '棉纺生产线，高价收购优质棉花',         buyItem: 'cotton',     basePrice: 5 },
  sugar_group:  { id: 'sugar_group',  name: '东方糖业集团',   emoji: '🍬', description: '制糖原料，长期合同收购甜菜',           buyItem: 'sugar_beet', basePrice: 6 },
  brewery:      { id: 'brewery',      name: '精酿啤酒厂',     emoji: '🍺', description: '精酿啤酒源头，高价收购优质啤酒花',     buyItem: 'hops',       basePrice: 8 },
  juice_factory:{ id: 'juice_factory',name: '鲜榨果汁加工厂', emoji: '🧃', description: 'NFC果汁生产线，大量采购新鲜水果',      buyItem: 'apple',      basePrice: 7 },
  pharma_group: { id: 'pharma_group', name: '联合制药集团',   emoji: '💊', description: '中药提取线，高价收购珍稀药材',         buyItem: 'ginseng',    basePrice: 20 },
  spice_house:  { id: 'spice_house',  name: '皇家香料行',     emoji: '🌶️', description: '顶级香料供应商，全球采购珍稀香料',     buyItem: 'saffron',    basePrice: 15 },
}

export const COMPANY_IDS = Object.keys(COMPANIES)

export function getCompanyName(id: string): string {
  return COMPANIES[id]?.name ?? id
}

export function getCompanyEmoji(id: string): string {
  return COMPANIES[id]?.emoji ?? '🏢'
}

// ===== 3. 作物配置 =====
export interface CropConfig {
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
}

export const ALL_CROPS: Record<string, CropConfig> = {
  // 🌾 谷物薯类
  wheat:        { id: 'wheat',         name: '小麦',   emoji: '🌾', category: 'grain',     totalTimeMin: 10,  yield: 4, baseSeedPrice: 2,   baseSellPrice: 3,   companyId: 'flour_mill',   companyName: '红星面粉厂',     companyEmoji: '🏭' },
  corn:         { id: 'corn',          name: '玉米',   emoji: '🌽', category: 'grain',     totalTimeMin: 28,  yield: 3, baseSeedPrice: 4,   baseSellPrice: 6,   companyId: 'power_plant',  companyName: '城市热电厂',     companyEmoji: '⚡' },
  rice:         { id: 'rice',          name: '水稻',   emoji: '🍚', category: 'grain',     totalTimeMin: 35,  yield: 3, baseSeedPrice: 5,   baseSellPrice: 8,   companyId: 'brewery',      companyName: '精酿啤酒厂',     companyEmoji: '🍺' },
  sorghum:      { id: 'sorghum',       name: '高粱',   emoji: '🌾', category: 'grain',     totalTimeMin: 20,  yield: 4, baseSeedPrice: 2,   baseSellPrice: 3,   companyId: 'feed_factory', companyName: '全民饲料厂',     companyEmoji: '🌾' },
  potato:       { id: 'potato',        name: '土豆',   emoji: '🥔', category: 'grain',     totalTimeMin: 15,  yield: 5, baseSeedPrice: 3,   baseSellPrice: 3,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  sweet_potato: { id: 'sweet_potato',  name: '红薯',   emoji: '🍠', category: 'grain',     totalTimeMin: 18,  yield: 5, baseSeedPrice: 3,   baseSellPrice: 3,   companyId: 'feed_factory', companyName: '全民饲料厂',     companyEmoji: '🌾' },
  oat:          { id: 'oat',           name: '燕麦',   emoji: '🌾', category: 'grain',     totalTimeMin: 12,  yield: 4, baseSeedPrice: 2,   baseSellPrice: 3,   companyId: 'flour_mill',   companyName: '红星面粉厂',     companyEmoji: '🏭' },
  barley:       { id: 'barley',        name: '大麦',   emoji: '🌾', category: 'grain',     totalTimeMin: 25,  yield: 3, baseSeedPrice: 4,   baseSellPrice: 6,   companyId: 'brewery',      companyName: '精酿啤酒厂',     companyEmoji: '🍺' },
  hops:         { id: 'hops',          name: '啤酒花', emoji: '🍺', category: 'cash',      totalTimeMin: 45,  yield: 3, baseSeedPrice: 8,   baseSellPrice: 14,  companyId: 'brewery',      companyName: '精酿啤酒厂',     companyEmoji: '🍺' },
  // 🥬 日常蔬菜
  cabbage:      { id: 'cabbage',       name: '白菜',   emoji: '🥬', category: 'vegetable', totalTimeMin: 8,   yield: 5, baseSeedPrice: 2,   baseSellPrice: 2,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  tomato:       { id: 'tomato',        name: '番茄',   emoji: '🍅', category: 'vegetable', totalTimeMin: 15,  yield: 4, baseSeedPrice: 3,   baseSellPrice: 4,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  cucumber:     { id: 'cucumber',      name: '黄瓜',   emoji: '🥒', category: 'vegetable', totalTimeMin: 10,  yield: 4, baseSeedPrice: 2,   baseSellPrice: 3,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  garlic:       { id: 'garlic',        name: '大蒜',   emoji: '🧄', category: 'vegetable', totalTimeMin: 30,  yield: 3, baseSeedPrice: 5,   baseSellPrice: 8,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  ginger:       { id: 'ginger',        name: '生姜',   emoji: '🫚', category: 'vegetable', totalTimeMin: 35,  yield: 3, baseSeedPrice: 6,   baseSellPrice: 10,  companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  carrot:       { id: 'carrot',        name: '胡萝卜', emoji: '🥕', category: 'vegetable', totalTimeMin: 12,  yield: 4, baseSeedPrice: 2,   baseSellPrice: 3,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  onion:        { id: 'onion',         name: '洋葱',   emoji: '🧅', category: 'vegetable', totalTimeMin: 22,  yield: 4, baseSeedPrice: 3,   baseSellPrice: 4,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  chili:        { id: 'chili',         name: '辣椒',   emoji: '🌶️', category: 'vegetable', totalTimeMin: 20,  yield: 4, baseSeedPrice: 3,   baseSellPrice: 5,   companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  // 🍎 水果类
  apple:        { id: 'apple',         name: '苹果',   emoji: '🍎', category: 'fruit',     totalTimeMin: 40,  yield: 3, baseSeedPrice: 6,   baseSellPrice: 10,  companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  grape:        { id: 'grape',         name: '葡萄',   emoji: '🍇', category: 'fruit',     totalTimeMin: 50,  yield: 3, baseSeedPrice: 8,   baseSellPrice: 14,  companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  strawberry:   { id: 'strawberry',    name: '草莓',   emoji: '🍓', category: 'fruit',     totalTimeMin: 30,  yield: 4, baseSeedPrice: 5,   baseSellPrice: 8,   companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  orange:       { id: 'orange',        name: '柑橘',   emoji: '🍊', category: 'fruit',     totalTimeMin: 45,  yield: 3, baseSeedPrice: 7,   baseSellPrice: 12,  companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  peach:        { id: 'peach',         name: '水蜜桃', emoji: '🍑', category: 'fruit',     totalTimeMin: 55,  yield: 2, baseSeedPrice: 10,  baseSellPrice: 20,  companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  pear:         { id: 'pear',          name: '梨',     emoji: '🍐', category: 'fruit',     totalTimeMin: 35,  yield: 3, baseSeedPrice: 5,   baseSellPrice: 9,   companyId: 'juice_factory',companyName: '鲜榨果汁加工厂',   companyEmoji: '🧃' },
  cherry:       { id: 'cherry',        name: '樱桃',   emoji: '🍒', category: 'fruit',     totalTimeMin: 60,  yield: 2, baseSeedPrice: 12,  baseSellPrice: 25,  companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  watermelon:   { id: 'watermelon',    name: '西瓜',   emoji: '🍉', category: 'fruit',     totalTimeMin: 45,  yield: 2, baseSeedPrice: 8,   baseSellPrice: 18,  companyId: 'supermarket',  companyName: '大润发连锁超市', companyEmoji: '🛒' },
  // 💰 经济作物
  cotton:       { id: 'cotton',        name: '棉花',   emoji: '☁️', category: 'cash',      totalTimeMin: 50,  yield: 3, baseSeedPrice: 8,   baseSellPrice: 14,  companyId: 'textile_mill', companyName: '第一纺织厂',     companyEmoji: '🧵' },
  sugar_beet:   { id: 'sugar_beet',    name: '甜菜',   emoji: '🍬', category: 'cash',      totalTimeMin: 40,  yield: 4, baseSeedPrice: 6,   baseSellPrice: 10,  companyId: 'sugar_group',  companyName: '东方糖业集团',   companyEmoji: '🍬' },
  tobacco:      { id: 'tobacco',       name: '烟叶',   emoji: '🚬', category: 'cash',      totalTimeMin: 70,  yield: 2, baseSeedPrice: 15,  baseSellPrice: 35,  companyId: 'spice_house',  companyName: '皇家香料行',     companyEmoji: '🌶️' },
  soybean:      { id: 'soybean',       name: '大豆',   emoji: '🫘', category: 'cash',      totalTimeMin: 30,  yield: 3, baseSeedPrice: 5,   baseSellPrice: 9,   companyId: 'feed_factory', companyName: '全民饲料厂',     companyEmoji: '🌾' },
  peanut:       { id: 'peanut',        name: '花生',   emoji: '🥜', category: 'cash',      totalTimeMin: 35,  yield: 3, baseSeedPrice: 6,   baseSellPrice: 11,  companyId: 'sugar_group',  companyName: '东方糖业集团',   companyEmoji: '🍬' },
  tea:          { id: 'tea',           name: '茶叶',   emoji: '🍵', category: 'cash',      totalTimeMin: 60,  yield: 2, baseSeedPrice: 12,  baseSellPrice: 28,  companyId: 'spice_house',  companyName: '皇家香料行',     companyEmoji: '🌶️' },
  coffee:       { id: 'coffee',        name: '咖啡豆', emoji: '☕', category: 'cash',      totalTimeMin: 80,  yield: 2, baseSeedPrice: 18,  baseSellPrice: 40,  companyId: 'spice_house',  companyName: '皇家香料行',     companyEmoji: '🌶️' },
  hemp:         { id: 'hemp',          name: '工业大麻',emoji: '🌿', category: 'cash',      totalTimeMin: 45,  yield: 3, baseSeedPrice: 7,   baseSellPrice: 13,  companyId: 'textile_mill', companyName: '第一纺织厂',     companyEmoji: '🧵' },
  // 🌿 珍稀草药
  ginseng:      { id: 'ginseng',       name: '人参',   emoji: '🌱', category: 'herb',      totalTimeMin: 180, yield: 1, baseSeedPrice: 50,  baseSellPrice: 120, companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
  saffron:      { id: 'saffron',       name: '藏红花', emoji: '🌸', category: 'herb',      totalTimeMin: 240, yield: 1, baseSeedPrice: 80,  baseSellPrice: 200, companyId: 'spice_house',  companyName: '皇家香料行',     companyEmoji: '🌶️' },
  ganoderma:    { id: 'ganoderma',     name: '灵芝',   emoji: '🍄', category: 'herb',      totalTimeMin: 300, yield: 1, baseSeedPrice: 120, baseSellPrice: 300, companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
  cordyceps:    { id: 'cordyceps',     name: '冬虫夏草',emoji: '🐛', category: 'herb',      totalTimeMin: 360, yield: 1, baseSeedPrice: 200, baseSellPrice: 500, companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
  aloe:         { id: 'aloe',          name: '芦荟',   emoji: '🌵', category: 'herb',      totalTimeMin: 60,  yield: 3, baseSeedPrice: 10,  baseSellPrice: 18,  companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
  mint:         { id: 'mint',          name: '薄荷',   emoji: '🌿', category: 'herb',      totalTimeMin: 15,  yield: 5, baseSeedPrice: 3,   baseSellPrice: 4,   companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
  lavender:     { id: 'lavender',      name: '薰衣草', emoji: '💜', category: 'herb',      totalTimeMin: 45,  yield: 3, baseSeedPrice: 8,   baseSellPrice: 15,  companyId: 'spice_house',  companyName: '皇家香料行',     companyEmoji: '🌶️' },
  angelica:     { id: 'angelica',      name: '当归',   emoji: '🌿', category: 'herb',      totalTimeMin: 120, yield: 2, baseSeedPrice: 25,  baseSellPrice: 55,  companyId: 'pharma_group', companyName: '联合制药集团',   companyEmoji: '💊' },
}

export const CROP_IDS = Object.keys(ALL_CROPS)

// ===== 4. 辅助函数 =====

/** 按分类分组作物 */
export function getCropsByCategory(): Record<CropCategory, CropConfig[]> {
  const groups: Record<CropCategory, CropConfig[]> = {
    grain: [], vegetable: [], fruit: [], cash: [], herb: [],
  }
  for (const c of Object.values(ALL_CROPS)) {
    groups[c.category].push(c)
  }
  return groups
}

/** 获取作物显示名称 */
export function getCropName(id: string): string {
  return ALL_CROPS[id]?.name ?? id
}

/** 获取作物 emoji */
export function getCropEmoji(id: string): string {
  return ALL_CROPS[id]?.emoji ?? '🌱'
}

/** 获取作物配置 */
export function getCropConfig(id: string): CropConfig | undefined {
  return ALL_CROPS[id]
}

/** 根据企业 ID 获取对口作物 */
export function getCropByCompany(companyId: string): CropConfig | undefined {
  return Object.values(ALL_CROPS).find((c) => c.companyId === companyId)
}
