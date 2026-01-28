/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Базовые
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string

  // API
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_TIMEOUT: string
  readonly VITE_API_MOCK: string

  // Расширение
  readonly VITE_EXTENSION_ID: string
  readonly VITE_DEFAULT_CACHE_TTL: string

  // Отладка
  readonly VITE_DEBUG: string
  readonly VITE_ENABLE_LOGGING: string
  readonly VITE_HOT_RELOAD: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
