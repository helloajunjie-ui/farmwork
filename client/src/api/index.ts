/**
 * 真实 API 层 — 对接后端 Express 服务
 *
 * MVP 5.0: 全局 JWT 鉴权
 * - 请求拦截器：自动注入 Authorization: Bearer <token>
 * - 响应拦截器：401 时清空 Token 并跳转登录页
 */
import axios from 'axios'
import type {
  UserInfo,
  Plot,
  HarvestResponse,
  BuyResponse,
  UnlockResponse,
  CowStatus,
  BuySeedResponse,
  OrderBookData,
  ApiResponse,
  CompanyInfo,
  SellToCompanyResponse,
} from '../types'

const http = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ===== 请求拦截器：自动注入 JWT =====
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ===== 响应拦截器：统一错误处理 =====
http.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse<any>
    if (body.code !== 0) {
      return Promise.reject(body)
    }
    return res
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清空并跳转登录页
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject({ code: 4001, message: '登录凭证已过期，请重新登录' })
    }
    return Promise.reject({ code: 9999, message: '网络开小差了，请稍后重试' })
  }
)

// ===== 鉴权 =====
export interface LoginResponse {
  token: string
  user: {
    user_id: number
    username: string
    nickname: string
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await http.post<ApiResponse<LoginResponse>>('/auth/login', { username, password })
  return res.data.data
}

// ===== 玩家 =====
export async function fetchUserInfo(): Promise<UserInfo> {
  const res = await http.get<ApiResponse<UserInfo>>('/user/info')
  return res.data.data
}

// ===== 农场 =====
export async function fetchPlots(): Promise<Plot[]> {
  const res = await http.get<ApiResponse<Plot[]>>('/farm/plots')
  return res.data.data
}

export async function plant(plotId: number, crop: string): Promise<void> {
  await http.post('/farm/plant', { plot_id: plotId, crop })
}

export async function harvest(plotId: number): Promise<HarvestResponse> {
  const res = await http.post<ApiResponse<HarvestResponse>>('/farm/harvest', {
    plot_id: plotId,
  })
  return res.data.data
}

export async function unlockPlot(plotId: number): Promise<UnlockResponse> {
  const res = await http.post<ApiResponse<UnlockResponse>>('/farm/unlock', {
    plot_id: plotId,
  })
  return res.data.data
}

export async function buyCow(): Promise<void> {
  await http.post('/farm/buy-cow')
}

export async function fetchCowStatus(): Promise<CowStatus> {
  const res = await http.get<ApiResponse<CowStatus>>('/farm/cow-status')
  return res.data.data
}

export async function buySeed(amount: number, crop?: string): Promise<BuySeedResponse> {
  const res = await http.post<ApiResponse<BuySeedResponse>>('/farm/buy-seed', { amount, crop })
  return res.data.data
}

/** 获取某个作物的当前种子售价 */
export async function fetchSeedPrice(cropId: string): Promise<number> {
  const res = await http.get<ApiResponse<{ price: number }>>(`/farm/seed-price?crop=${cropId}`)
  return res.data.data.price
}

// ===== 市场 =====

/** 获取盘口深度数据（MVP 4.3: 支持按作物过滤） */
export async function fetchOrderBook(itemId?: string): Promise<OrderBookData> {
  const params = itemId ? { item_id: itemId } : {}
  const res = await http.get<ApiResponse<OrderBookData>>('/market/orders', { params })
  return res.data.data
}

// ===== 企业（系统买家） =====

/** 获取企业收购价 */
export async function fetchCompanies(): Promise<CompanyInfo[]> {
  const res = await http.get<ApiResponse<CompanyInfo[]>>('/market/companies')
  return res.data.data
}

/** 直接卖给企业 */
export async function sellToCompany(
  item: string,
  amount: number
): Promise<SellToCompanyResponse> {
  const res = await http.post<ApiResponse<SellToCompanyResponse>>('/market/sell-to-company', {
    item,
    amount,
  })
  return res.data.data
}

/** 挂单卖出（传入单价，后端计算总价） */
export async function sell(
  item: string,
  amount: number,
  unitPrice: number
): Promise<void> {
  await http.post('/market/sell', { item, amount, unit_price: unitPrice })
}

// ===== MVP 7.0: 社交名片 & 房产 =====
import type { ProfileData, UpgradeHouseResponse } from '../types'

export async function fetchProfile(username: string): Promise<ProfileData> {
  const res = await http.get<ApiResponse<ProfileData>>(`/social/profile/${username}`)
  return res.data.data
}

export async function upgradeHouse(): Promise<UpgradeHouseResponse> {
  const res = await http.post<ApiResponse<UpgradeHouseResponse>>('/social/upgrade-house')
  return res.data.data
}

/** 买入订单 */
export async function buy(orderId: number): Promise<BuyResponse> {
  const res = await http.post<ApiResponse<BuyResponse>>('/market/buy', {
    order_id: orderId,
  })
  return res.data.data
}

// ===== MVP 6.0: 排行榜 =====
import type { LeaderboardData } from '../types'

export async function fetchLeaderboard(): Promise<LeaderboardData> {
  const res = await http.get<ApiResponse<LeaderboardData>>('/leaderboard')
  return res.data.data
}
