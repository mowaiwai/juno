/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'false' 时走真实后端，其他值/缺省走 mock */
  readonly VITE_USE_MOCK?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
