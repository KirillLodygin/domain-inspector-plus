<template>
  <div class="min-h-[400px] p-4 bg-gradient-to-b from-gray-50 to-white">
    <!-- Заголовок -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <span class="text-white font-bold text-sm">DI</span>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Domain Inspector</h1>
          <p class="text-xs text-gray-500">Instant domain information</p>
        </div>
      </div>
      <button
        @click="openOptions"
        class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
        title="Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>

    <!-- Поле ввода -->
    <div class="mb-6">
      <div class="relative">
        <input
          v-model="domainInput"
          @keyup.enter="inspectDomain"
          type="text"
          placeholder="Enter domain or IP address..."
          class="w-full px-4 py-3 pl-11 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <div class="absolute left-3 top-3 text-gray-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          @click="inspectDomain"
          :disabled="!domainInput || loading"
          class="absolute right-2 top-2 px-3 py-1 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Inspect
        </button>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        You can also highlight any domain on a page and right-click to inspect
      </p>
    </div>

    <!-- Состояние загрузки -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-12">
      <div
        class="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"
      ></div>
      <p class="text-gray-600">Inspecting domain...</p>
    </div>

    <!-- Сообщение об ошибке -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">
            <p>{{ error }}</p>
          </div>
        </div>
      </div>
      <div class="mt-4">
        <button @click="retry" class="text-sm font-medium text-red-800 hover:text-red-900">
          Try again
        </button>
      </div>
    </div>

    <!-- Результаты -->
    <div v-else-if="domainInfo" class="space-y-4">
      <!-- Заголовок домена -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ domainInfo.domain }}</h2>
            <p class="text-sm text-gray-500">Domain information</p>
          </div>
          <button
            @click="copyAllInfo"
            class="flex items-center space-x-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            <span>Copy All</span>
          </button>
        </div>
      </div>

      <!-- Информация о домене -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Регистрация -->
        <div class="info-card">
          <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
            <svg
              class="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Registration
          </h3>
          <div class="space-y-2">
            <div class="info-row">
              <span class="info-label">Created</span>
              <span class="info-value">{{ formatDate(domainInfo.created) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Expires</span>
              <span class="info-value">{{ formatDate(domainInfo.expires) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Registrar</span>
              <span class="info-value">{{ domainInfo.registrar || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Сеть -->
        <div class="info-card">
          <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
            <svg
              class="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Network
          </h3>
          <div class="space-y-2">
            <div class="info-row">
              <span class="info-label">IP Address</span>
              <span class="info-value font-mono">{{ domainInfo.ip }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Country</span>
              <span class="info-value">{{ domainInfo.country }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">AS Number</span>
              <span class="info-value font-mono">{{ domainInfo.as }}</span>
            </div>
          </div>
        </div>

        <!-- DNS -->
        <div class="info-card md:col-span-2">
          <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
            <svg
              class="w-4 h-4 mr-2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            DNS Servers
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 rounded p-3">
              <div class="text-xs text-gray-500 mb-1">Primary</div>
              <div class="font-mono text-sm truncate">{{ domainInfo.ns1 || 'Not found' }}</div>
            </div>
            <div class="bg-gray-50 rounded p-3">
              <div class="text-xs text-gray-500 mb-1">Secondary</div>
              <div class="font-mono text-sm truncate">{{ domainInfo.ns2 || 'Not found' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Быстрые действия -->
      <div class="flex space-x-2 pt-4 border-t border-gray-200">
        <button
          @click="openWhois"
          class="flex-1 btn btn-secondary flex items-center justify-center space-x-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          <span>Open WHOIS</span>
        </button>
        <button
          @click="pingDomain"
          class="flex-1 btn btn-secondary flex items-center justify-center space-x-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span>Ping Test</span>
        </button>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <div class="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No Domain Inspected</h3>
      <p class="text-gray-600 max-w-xs">
        Enter a domain above or highlight any domain on a webpage and right-click to inspect.
      </p>
    </div>

    <!-- Футер -->
    <div class="mt-8 pt-4 border-t border-gray-200 text-center">
      <p class="text-xs text-gray-500">
        Domain Inspector Plus v{{ version }}
        <br />
        <button @click="openOptions" class="text-primary-600 hover:text-primary-800">
          Settings
        </button>
        •
        <a href="#" @click.prevent="reportBug" class="text-primary-600 hover:text-primary-800">
          Report Bug
        </a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import type { DomainInfo } from '@/lib/types'
  import { formatDate, copyToClipboard } from '@/lib/utils'

  const version = '0.1.0'
  const loading = ref(false)
  const error = ref('')
  const domainInput = ref('')
  const domainInfo = ref<DomainInfo | null>(null)

  // Инициализация
  onMounted(() => {
    // Получаем домен из storage, если есть
    chrome.storage.local.get(['lastDomain'], result => {
      if (result.lastDomain) {
        domainInput.value = result.lastDomain
        inspectDomain()
        chrome.storage.local.remove('lastDomain')
      }
    })
  })

  // Проверка домена
  const inspectDomain = async () => {
    if (!domainInput.value.trim()) return

    loading.value = true
    error.value = ''

    try {
      // TODO: Заменить на реальный API вызов
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Тестовые данные для разработки
      domainInfo.value = {
        domain: domainInput.value,
        created: '2020-01-15',
        expires: '2025-01-15',
        registrar: 'GoDaddy',
        ip: '93.184.216.34',
        country: 'United States',
        as: 'AS15169 Google',
        ns1: 'ns1.example.com',
        ns2: 'ns2.example.com',
      }
    } catch (err) {
      error.value = 'Failed to inspect domain. Please try again.'
      console.error(err)
    } finally {
      loading.value = false
    }
  }

  // Копирование всей информации
  const copyAllInfo = async () => {
    if (!domainInfo.value) return

    const text = Object.entries(domainInfo.value)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    const success = await copyToClipboard(text)
    if (success) {
      // Показать уведомление об успехе
      alert('Domain information copied to clipboard!')
    }
  }

  // Действия
  const openWhois = () => {
    if (domainInfo.value?.domain) {
      window.open(`https://whois.domaintools.com/${domainInfo.value.domain}`, '_blank')
    }
  }

  const pingDomain = () => {
    if (domainInfo.value?.domain) {
      window.open(`https://ping.pe/${domainInfo.value.domain}`, '_blank')
    }
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const reportBug = () => {
    window.open('https://github.com/yourusername/domain-inspector-plus/issues', '_blank')
  }

  const retry = () => {
    error.value = ''
    if (domainInput.value) {
      inspectDomain()
    }
  }
</script>

<style scoped>
  /* Стили компонента */
</style>
