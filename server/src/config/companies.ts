// ===== 企业配置（桥接文件） =====
// 从 economy_matrix.ts 统一导出，保持向后兼容
// 所有新企业定义请编辑 economy_matrix.ts

export type { CompanyConfig } from './economy_matrix.js'
export { COMPANIES, COMPANY_IDS, isValidCompany } from './economy_matrix.js'
