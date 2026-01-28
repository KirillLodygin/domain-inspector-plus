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
                assets: 'src/assets',
                browser: 'chrome',
                watchFilePaths: ['src', 'public'],
                disableAutoLaunch: !isDev,
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
            rollupOptions: {
                input: {
                    popup: resolve(__dirname, 'src/popup/index.html'),
                    options: resolve(__dirname, 'src/options/index.html'),
                    background: resolve(__dirname, 'src/background/index.ts'),
                    content: resolve(__dirname, 'src/content/index.ts'),
                },
                output: {
                    entryFileNames: '[name]/index.js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash].[ext]',
                },
            },
            sourcemap: isDev,
        },
        server: {
            port: 3000,
            strictPort: true,
        },
    }
})