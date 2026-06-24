// ===== MVP 7.0: 前端房产配置（与后端 housing_matrix.ts 同步） =====
// 仅包含前端展示所需字段，完整数据由后端 API 返回

export interface HousingTierInfo {
  tier: number
  name: string
  emoji: string
  cost: number
  totalCost: number
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

const configs: Record<number, { name: string; emoji: string; description: string; color: string; badge: string }> = {
  1:  { name: '漏风茅草棚',       emoji: '🏚️',  description: '勉强能遮风挡雨，下雨天记得躲角落',                        color: 'border-slate-600',       badge: '🟫 流浪者' },
  2:  { name: '土坯小平房',       emoji: '🏠',  description: '虽然简陋，但至少不漏雨了',                                color: 'border-slate-500',       badge: '🟫 佃农' },
  3:  { name: '红砖瓦房',         emoji: '🏡',  description: '村里最体面的房子，媒婆开始上门了',                        color: 'border-stone-500',       badge: '🟫 自耕农' },
  4:  { name: '带院小洋楼',       emoji: '🏘️',  description: '有个小院子，可以种点花花草草',                            color: 'border-amber-700',       badge: '🥉 小富即安' },
  5:  { name: '郊区红砖平房',     emoji: '🏘️',  description: '虽然远了点，但胜在清静，周末还能烧烤',                    color: 'border-amber-600',       badge: '🥉 中产入门' },
  6:  { name: '县城电梯公寓',     emoji: '🏢',  description: '终于住上电梯房了，再也不用爬楼梯',                        color: 'border-amber-500',       badge: '🥉 中产' },
  7:  { name: '城市花园洋房',     emoji: '🏛️',  description: '小区绿化率 40%，物业 24 小时管家服务',                    color: 'border-yellow-500',      badge: '🥈 新贵' },
  8:  { name: '江景大平层',       emoji: '🏬',  description: '落地窗前，整条江都是你的风景',                            color: 'border-yellow-400',      badge: '🥈 富裕阶层' },
  9:  { name: '独栋湖畔别墅',     emoji: '🏰',  description: '私人码头 + 小游艇，周末约朋友开派对',                     color: 'border-yellow-300',      badge: '🥈 富豪' },
  10: { name: '曼哈顿高空大平层', emoji: '🗽',  description: '站在落地窗前，整座城市在你脚下',                          color: 'border-purple-400',      badge: '🥇 顶级富豪' },
  11: { name: '地中海悬崖别墅',   emoji: '🏝️',  description: '无边泳池连着海平面，日出日落尽收眼底',                    color: 'border-purple-400',      badge: '🥇 亿万俱乐部' },
  12: { name: '私人岛屿庄园',     emoji: '🏝️',  description: '整座岛都是你的，直升机停机坪是标配',                      color: 'border-purple-300',      badge: '🥇 岛主' },
  13: { name: '阿尔卑斯雪山城堡', emoji: '🏔️',  description: '在云端拥有一座城堡，俯瞰众生',                            color: 'border-purple-300',      badge: '🥇 城堡主' },
  14: { name: '太空边缘酒店',     emoji: '🚀',  description: '大气层边缘的豪华套房，地球是窗外的装饰画',                color: 'border-cyan-400',        badge: '💎 星际旅者' },
  15: { name: '悬崖无边泳池别墅', emoji: '🌊',  description: '他在云端俯瞰着你们的劳作',                                color: 'border-cyan-300',        badge: '💎 传奇' },
  16: { name: '地心熔岩堡垒',     emoji: '🌋',  description: '深入地心，岩浆是你的壁炉',                                color: 'border-red-400',         badge: '💎 深渊领主' },
  17: { name: '平流层飞艇行宫',   emoji: '🎈',  description: '永不停歇的环球航行，云层是你的花园',                      color: 'border-red-300',         badge: '💎 天空之主' },
  18: { name: '月球环形山基地',   emoji: '🌙',  description: '在月球上拥有一个私人基地，地球是蓝色的背景板',            color: 'border-rose-400',        badge: '👑 月球领主' },
  19: { name: '戴森云能量宫殿',   emoji: '☀️',  description: '你的宫殿环绕恒星运行，能量取之不尽',                      color: 'border-rose-300',        badge: '👑 恒星领主' },
  20: { name: '近地轨道赛博庄园', emoji: '🌌',  description: '全服唯一的终极象征。你已超越了财富的范畴，成为了传说',    color: 'border-yellow-200',      badge: '👑 传说' },
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
