/** API 环境配置（Vite 环境变量，见 .env / .env.local）。 */

/** true=使用内置 mock（默认，保部署原型）；false=走真实后端 */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';

/** 后端 API 根地址 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1';
