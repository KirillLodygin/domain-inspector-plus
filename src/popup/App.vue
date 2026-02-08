<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import browser from 'webextension-polyfill'
  import type { DomainInfo } from '@/lib/types'
  import { formatDate, getCountryName, formatNS, copyToClipboard, isValidDomain } from '@/lib/utils'
  import { inspectDomain as apiInspectDomain } from '@/lib/api'

  const loading = ref(false)
  const error = ref('')
  const domainInput = ref('')
  const domainInfo = ref<DomainInfo | null>(null)
  const copyStatus = ref('')

  // Инициализация
  onMounted(async () => {
    try {
      const result = await browser.storage.local.get('lastDomain')
      
      if (result.lastDomain && typeof result.lastDomain === 'string') {
        domainInput.value = result.lastDomain
        
        // Автоматически запускаем инспекцию
        await inspectDomain()
      }
    } catch (error) {
      console.error('Storage error:', error)
    }
    
    // Listen for Escape key
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  let inspectTimeout: number | null = null
  watch(domainInput, (newVal) => {
    if (inspectTimeout) clearTimeout(inspectTimeout)
    if (newVal && isValidDomain(newVal)) {
      inspectTimeout = window.setTimeout(() => {
        if (domainInfo.value?.domain !== newVal) {
          inspectDomain()
        }
      }, 500)
    }
  })

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePopup()
    }
  }

  // Проверка домена
  const inspectDomain = async () => {
    if (!domainInput.value.trim()) return

    const domain = domainInput.value.trim()
    
    loading.value = true
    error.value = ''
    domainInfo.value = null

    try {
      const response = await apiInspectDomain(domain)
      
      if (response.success && response.data) {
        domainInfo.value = response.data
      } else {
        error.value = response.error || 'Failed to inspect domain'
      }
    } catch (err) {
      console.error('Exception caught:', err)
      error.value = 'Connection error'
    } finally {
      loading.value = false
    }
  }

  // Копирование всей информации
  const copyAllInfo = async () => {
    if (!domainInfo.value) return

    const info = domainInfo.value
    const { primary, othersCount } = formatNS(info.ns)
    const nsText = othersCount > 0 
      ? `${primary.join(', ')} and ${othersCount} more`
      : primary.join(', ')

    const text = [
      `Domain: ${info.domain}`,
      `Created: ${formatDate(info.created)}`,
      `IP: ${info.ip}`,
      `Country: ${getCountryName(info.country)}`,
      `NS: ${info.ns.join(', ')}`
    ].join('\n')

    const success = await copyToClipboard(text)
    if (success) {
      copyStatus.value = 'Copied!'
      setTimeout(() => copyStatus.value = '', 2000)
    }
  }

  const closePopup = () => {
    window.close()
  }

  const retry = () => {
    error.value = ''
    inspectDomain()
  }
</script>

<template>
  <div class="w-[400px] max-h-[600px] bg-sage-50 text-sage-900 font-sans relative flex flex-col overflow-hidden">
    <!-- Close Button -->
    <button 
      @click="closePopup" 
      class="absolute top-4 right-4 text-sage-400 hover:text-sage-600 z-10 p-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Header -->
    <div class="p-6 pb-4 border-b border-sage-100 bg-sage-50/50">
      <div class="flex items-center space-x-3 mb-4">
        <div class="w-10 h-10 flex items-center justify-center">
          <img src="/icons/icon-48.png" alt="Domain Inspector+" class="w-10 h-10" />
        </div>
        <div>
          <h1 class="text-lg font-bold text-sage-900 leading-tight">Domain Inspector+</h1>
          <p class="text-xs text-sage-500 font-medium">Professional Domain Analysis</p>
        </div>
      </div>

      <!-- Input Section -->
      <div class="relative">
        <input
          v-model="domainInput"
          @keyup.enter="inspectDomain"
          type="text"
          placeholder="Enter domain (e.g. google.com)"
          class="w-full pl-4 pr-12 py-2.5 bg-white border border-sage-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none shadow-sm"
        />
        <button 
          @click="inspectDomain"
          :disabled="loading || !domainInput"
          class="absolute right-2 top-1.5 p-1.5 text-primary-600 hover:bg-primary-50 rounded-md disabled:opacity-30"
        >
          <svg v-if="!loading" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div v-else class="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 p-6 overflow-y-auto">
      <!-- Empty State -->
      <div v-if="!loading && !domainInfo && !error" class="flex flex-col items-center justify-center py-10 text-center">
        <div class="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mb-4 text-primary-500">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="font-semibold text-sage-800">Ready to Inspect</h3>
        <p class="text-xs text-sage-500 mt-1 px-8">Enter a domain above or use context menu on any website to see instant details.</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-4">
        <div class="h-20 bg-sage-50 rounded-xl animate-pulse"></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="h-24 bg-sage-50 rounded-xl animate-pulse"></div>
          <div class="h-24 bg-sage-50 rounded-xl animate-pulse"></div>
        </div>
        <div class="h-32 bg-sage-50 rounded-xl animate-pulse"></div>
      </div>

      <!-- Error State -->
      <div v-if="error && !loading" class="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
        <div class="text-red-500 mb-2">
          <svg class="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-red-800">{{ error }}</p>
        <button @click="retry" class="mt-3 px-4 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors">
          Retry Analysis
        </button>
      </div>

      <!-- Result State -->
      <div v-if="domainInfo && !loading" class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-bold text-sage-500 uppercase tracking-wider">Domain Details</h2>
          <button @click="copyAllInfo" class="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center">
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ copyStatus || 'Copy All' }}
          </button>
        </div>

        <div class="space-y-3">
          <!-- Domain Card -->
          <div class="p-4 bg-sage-50 rounded-xl border border-sage-100 flex items-center justify-between">
            <div>
              <p class="text-[10px] font-bold text-sage-400 uppercase">Domain</p>
              <p class="text-sm font-bold text-sage-900">{{ domainInfo.domain }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold text-sage-400 uppercase">Created</p>
              <p class="text-sm font-semibold text-sage-700">{{ formatDate(domainInfo.created) }}</p>
            </div>
          </div>

          <!-- Network Card -->
          <div class="p-4 bg-sage-50 rounded-xl border border-sage-100 grid grid-cols-2 gap-4">
            <div>
              <p class="text-[10px] font-bold text-sage-400 uppercase">IP Address</p>
              <p class="text-sm font-semibold text-sage-700 font-mono">{{ domainInfo.ip }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold text-sage-400 uppercase">Country</p>
              <p class="text-sm font-semibold text-sage-700">{{ getCountryName(domainInfo.country) }}</p>
            </div>
          </div>

          <!-- DNS Card -->
          <div class="p-4 bg-primary-50 rounded-xl border border-primary-100">
            <p class="text-[10px] font-bold text-primary-400 uppercase mb-2">Name Servers</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="ns in domainInfo.ns" :key="ns" class="px-2 py-1 bg-white border border-primary-100 text-primary-700 text-[10px] font-mono rounded shadow-sm">
                {{ ns }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 bg-sage-50 border-t border-sage-100 text-center">
      <p class="text-[10px] text-sage-400 font-medium">Domain Inspector+ v0.1.0 • Powered by Vercel API</p>
    </div>
  </div>
</template>

<style scoped>
  /* Стили компонента */
</style>
