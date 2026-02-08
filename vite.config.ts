import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig(({ mode }) => {
    const isDev = mode === 'chrome'

    return {
        plugins: [
            vue(),
            webExtension({
                manifest: 'src/manifest.json',
                browser: 'chrome',
                watchFilePaths: ['src', 'public'],
                disableAutoLaunch: !isDev,
                // Примечание: предупреждение о json.schemastore.org является известной проблемой плагина
                // и не влияет на функциональность. Manifest валиден и расширение работает корректно.
                // Альтернативных опций для отключения валидации в текущей версии плагина нет.
            }),
        ],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
            },
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: isDev,
        },
        server: {
            port: 3000,
            strictPort: true,
        },
    }
})