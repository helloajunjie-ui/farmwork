// ===== 作物配置（桥接文件） =====
// 从 economy_matrix.ts 统一导出，保持向后兼容
// 所有新作物定义请编辑 economy_matrix.ts

export type { CropConfig } from './economy_matrix.js'
export { CROPS, CROP_IDS, isValidCrop, getCropsByCategory, calcStages, calcProfitMargin, getCropIdsByCategory } from './economy_matrix.js'
export type { CropCategory } from './economy_matrix.js'
export { CATEGORY_LABELS } from './economy_matrix.js'
