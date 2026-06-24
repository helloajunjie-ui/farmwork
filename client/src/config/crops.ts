// ===== 向后兼容桥接层 =====
// 旧文件统一从 gameData.ts 重新导出，确保已有 import 不报错

export {
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  COMPANIES,
  COMPANY_IDS,
  ALL_CROPS,
  CROP_IDS,
  getCropsByCategory,
  getCropName,
  getCropEmoji,
  getCropConfig,
  getCropByCompany,
  getCompanyName,
  getCompanyEmoji,
} from './gameData'

export type {
  CropConfig,
  CompanyConfig,
} from './gameData'
