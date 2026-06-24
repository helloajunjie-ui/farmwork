// ===== MVP 8.1: 前端房产配置 + 双重计价 =====
// 与后端 housing_matrix.ts 同步

export interface HousingTierInfo {
  tier: number
  name: string
  emoji: string
  cost: number
  totalCost: number
  fiatValue: string   // 现实估值，如 "¥ 65,180,000 RMB"
  description: string
  color: string
  badge: string
}

function calcCost(tier: number): number {
  return Math.round(100 * Math.pow(2.5, tier - 1) * (1 + tier * 0.1))
}

function calcTotal(tier: number): number {
  let total = 0
  for (let i = 1; i <= tier; i++) total += calcCost(i)
  return total
}

const configs: Record<number, { name: string; emoji: string; fiatValue: string; description: string; color: string; badge: string }> = {
  1:  { name: '漏风茅草棚',       emoji: '🏚️',  fiatValue: '¥ 800/月 租金',              description: '勉强能遮风挡雨，下雨天记得躲角落',                        color: 'border-slate-600',       badge: '🟫 流浪者' },
  2:  { name: '土坯小平房',       emoji: '🏠',  fiatValue: '¥ 50,000 RMB',               description: '虽然简陋，但至少不漏雨了',                                color: 'border-slate-500',       badge: '🟫 佃农' },
  3:  { name: '红砖瓦房',         emoji: '🏡',  fiatValue: '¥ 180,000 RMB',              description: '村里最体面的房子，媒婆开始上门了',                        color: 'border-stone-500',       badge: '🟫 自耕农' },
  4:  { name: '带院小洋楼',       emoji: '🛖',  fiatValue: '¥ 680,000 RMB',              description: '有个小院子，可以种点花花草草',                            color: 'border-amber-700',       badge: '🥉 小富即安' },
  5:  { name: '郊区红砖平房',     emoji: '🏠',  fiatValue: '¥ 1,500,000 RMB',            description: '虽然远了点，但胜在清静，周末还能烧烤',                    color: 'border-amber-600',       badge: '🥉 中产入门' },
  6:  { name: '县城电梯公寓',     emoji: '🏢',  fiatValue: '¥ 3,800,000 RMB',            description: '终于住上电梯房了，再也不用爬楼梯',                        color: 'border-amber-500',       badge: '🥉 中产' },
  7:  { name: '城市花园洋房',     emoji: '🏛️',  fiatValue: '¥ 8,500,000 RMB',            description: '小区绿化率 40%，物业 24 小时管家服务',                    color: 'border-yellow-500',      badge: '🥈 新贵' },
  8:  { name: '陆家嘴江景大平层', emoji: '🏬',  fiatValue: '¥ 18,000,000 RMB',           description: '落地窗前，黄浦江尽收眼底',                                color: 'border-yellow-400',      badge: '🥈 富裕阶层' },
  9:  { name: '佘山独栋别墅',     emoji: '🏰',  fiatValue: '¥ 38,000,000 RMB',           description: '佘山脚下，私人花园 + 独立车库，上海滩新贵标配',            color: 'border-yellow-300',      badge: '🥈 富豪' },
  10: { name: '汤臣一品顶层复式', emoji: '🗽',  fiatValue: '¥ 118,000,000 RMB',          description: '陆家嘴之巅，黄浦江270°环幕视野，单价27.3万/㎡',            color: 'border-purple-400',      badge: '🥇 顶级富豪' },
  11: { name: '浦东一号独栋别墅', emoji: '🏯',  fiatValue: '¥ 180,000,000 RMB',          description: '浦东核心区，4层独栋带私人泳池与下沉式庭院',                color: 'border-purple-400',      badge: '🥇 亿万俱乐部' },
  12: { name: '西郊宾馆旁庄园',   emoji: '🌴',  fiatValue: '¥ 250,000,000 RMB',          description: '紧邻西郊国宾馆，占地3亩，政商名流汇聚之地',                color: 'border-purple-300',      badge: '🥇 岛主' },
  13: { name: '东郊壹号楼王',     emoji: '⛰️',  fiatValue: '¥ 315,000,000 RMB',          description: '张江板块顶豪，法拍成交价3.15亿，折合22.5万/㎡',             color: 'border-purple-300',      badge: '🥇 城堡主' },
  14: { name: '华洲君庭独栋',     emoji: '🏰',  fiatValue: '¥ 380,000,000 RMB',          description: '东郊顶级别墅，单套3.8亿，上海豪宅天花板',                  color: 'border-cyan-400',        badge: '💎 星际旅者' },
  15: { name: '严家花园百年洋房', emoji: '🌊',  fiatValue: '¥ 1,000,000,000 RMB',        description: '愚园路百年传世洋房，估值超10亿，有钱也买不到的藏品',       color: 'border-cyan-300',        badge: '💎 传奇' },
  16: { name: '檀宫顶级庄园',     emoji: '🌋',  fiatValue: '¥ 2,000,000,000 RMB',        description: '佘山脚下，8亩占地，20亿估值，全上海最贵的私人宅邸',         color: 'border-red-400',         badge: '💎 深渊领主' },
  17: { name: '平流层飞艇行宫',   emoji: '🎈',  fiatValue: '¥ 8,000,000,000 RMB',        description: '永不停歇的环球航行，云层是你的花园',                      color: 'border-red-300',         badge: '💎 天空之主' },
  18: { name: '月球环形山基地',   emoji: '🌙',  fiatValue: '¥ 50,000,000,000 RMB',       description: '在月球上拥有一个私人基地，地球是蓝色的背景板',            color: 'border-rose-400',        badge: '👑 月球领主' },
  19: { name: '戴森云能量宫殿',   emoji: '☀️',  fiatValue: '¥ 1,000,000,000,000 RMB',    description: '你的宫殿环绕恒星运行，能量取之不尽',                      color: 'border-rose-300',        badge: '👑 恒星领主' },
  20: { name: '近地轨道赛博庄园', emoji: '🌌',  fiatValue: '¥ ∞ 无法估量',              description: '全服唯一的终极象征。你已超越了财富的范畴，成为了传说',    color: 'border-yellow-200',      badge: '👑 传说' },
}

export const HOUSING_TIERS: HousingTierInfo[] = Array.from({ length: 20 }, (_, i) => {
  const tier = i + 1
  const cfg = configs[tier]
  return {
    tier,
    name: cfg.name,
    emoji: cfg.emoji,
    cost: calcCost(tier),
    totalCost: calcTotal(tier),
    fiatValue: cfg.fiatValue,
    description: cfg.description,
    color: cfg.color,
    badge: cfg.badge,
  }
})

export function getHousingTier(tier: number): HousingTierInfo {
  const idx = Math.max(0, Math.min(tier - 1, 19))
  return HOUSING_TIERS[idx]
}

export function getNextHousingTier(tier: number): HousingTierInfo | null {
  if (tier >= 20) return null
  return HOUSING_TIERS[tier]
}
