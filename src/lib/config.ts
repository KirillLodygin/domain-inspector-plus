export const config = {
  // Базовые
  appName: import.meta.env.VITE_APP_NAME || 'Domain Inspector Plus',
  appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',

  // API
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://domain-inspector-backend.vercel.app',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '10000', 10),
  useMockApi: import.meta.env.VITE_API_MOCK === 'true',

  // Расширение
  extensionId: import.meta.env.VITE_EXTENSION_ID || 'domain-inspector-plus',
  cacheTTL: parseInt(import.meta.env.VITE_DEFAULT_CACHE_TTL || '3600', 10),

  // Отладка
  isDebug: import.meta.env.VITE_DEBUG === 'true',
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === 'true' || import.meta.env.DEV,
  hotReload: import.meta.env.VITE_HOT_RELOAD === 'true',

  // Вычисляемые
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,

  // Методы
  log(...args: any[]) {
    if (this.enableLogging) {
      console.log(`[${this.appName}]`, ...args)
    }
  },

  warn(...args: any[]) {
    if (this.enableLogging) {
      console.warn(`[${this.appName}]`, ...args)
    }
  },

  error(...args: any[]) {
    if (this.enableLogging) {
      console.error(`[${this.appName}]`, ...args)
    }
  },
}
