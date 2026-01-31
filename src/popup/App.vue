<script setup lang="ts">
  import { ref, onMounted, computed, watch } from 'vue'
  import type { DomainInfo } from '@/lib/types'
  import { formatDate, getCountryName, formatNS, copyToClipboard } from '@/lib/utils'
  import { inspectDomain as apiInspectDomain } from '@/lib/api'

  const version = '0.1.0'
  const loading = ref(false)
  const error = ref('')
  const domainInput = ref('')
  const domainInfo = ref<DomainInfo | null>(null)
  const copyStatus = ref('')

  // Инициализация
  onMounted(() => {
    chrome.storage.local.get(['lastDomain'], result => {
      if (result.lastDomain) {
        domainInput.value = result.lastDomain
        chrome.storage.local.remove('lastDomain')
      }
    })

    // Listen for Escape key
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  // Watch domain property to trigger automatic requests
  watch(domainInput, (newVal) => {
    if (newVal && isValidDomain(newVal)) {
      inspectDomain()
    }
  })

  const isValidDomain = (domain: string) => {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain);
  }

  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePopup()
    }
  }

  // Проверка домена
  const inspectDomain = async () => {
    if (!domainInput.value.trim()) return

    loading.value = true
    error.value = ''
    domainInfo.value = null

    try {
      const response = await apiInspectDomain(domainInput.value.trim())
      if (response.success && response.data) {
        domainInfo.value = response.data
      } else {
        error.value = response.error || 'Failed to inspect domain'
      }
    } catch (err) {
      error.value = 'Connection error'
    } finally {
      loading.value = false
    }
  }

  // Копирование всей информации
  const copyAllInfo = async () => {
    if (!domainInfo.value) return

    const { primary, othersCount } = formatNS(domainInfo.value.ns)
    const nsText = othersCount > 0 
      ? `${primary.join(', ')} and ${othersCount} more`
      : primary.join(', ')

    const text = [
      `Domain: ${domainInfo.value.domain}`,
      `Created: ${formatDate(domainInfo.value.created)}`,
      `Expires: ${formatDate(domainInfo.value.expires)}`,
      `Registrar: ${domainInfo.value.registrar}`,
      `IP: ${domainInfo.value.ip}`,
      `Country: ${getCountryName(domainInfo.value.country)}`,
      `ASN: ${domainInfo.value.asn}`,
      `NS: ${nsText}`
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

  const formattedNS = computed(() => {
    if (!domainInfo.value?.ns) return { primary: [], othersCount: 0 }
    return formatNS(domainInfo.value.ns)
  })
</script>

<template>
  <div class="w-[400px] max-h-[600px] bg-white text-gray-900 font-sans relative flex flex-col overflow-hidden">
    <!-- Close Button -->
    <button 
      @click="closePopup" 
      class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 p-1"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>

    <!-- Header -->
    <div class="p-6 pb-4 border-b border-gray-100 bg-gray-50/50">
      <div class="flex items-center space-x-3 mb-4">
        <div class="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-200">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-900 leading-tight">Domain Inspector+</h1>
          <p class="text-xs text-gray-500 font-medium">Professional Domain Analysis</p>
        </div>
      </div>

      <!-- Input Section -->
      <div class="relative">
        <input
          v-model="domainInput"
          @keyup.enter="inspectDomain"
          type="text"
          placeholder="Enter domain (e.g. google.com)"
          class="w-full pl-4 pr-12 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none shadow-sm"
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
        <h3 class="font-semibold text-gray-800">Ready to Inspect</h3>
        <p class="text-xs text-gray-500 mt-1 px-8">Enter a domain above or use context menu on any website to see instant details.</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-4">
        <div class="h-20 bg-gray-50 rounded-xl animate-pulse"></div>
        <div class="grid grid-cols-2 gap-4">
          <div class="h-24 bg-gray-50 rounded-xl animate-pulse"></div>
          <div class="h-24 bg-gray-50 rounded-xl animate-pulse"></div>
        </div>
        <div class="h-32 bg-gray-50 rounded-xl animate-pulse"></div>
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
        <!-- Success Header -->
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-bold text-gray-800 flex items-center">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Analysis Complete
          </h2>
          <button @click="copyAllInfo" class="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center">
            <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ copyStatus || 'Copy All Data' }}
          </button>
        </div>

        <!-- Cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Registration</p>
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Created:</span>
                <span class="font-semibold text-gray-700">{{ formatDate(domainInfo.created) }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Expires:</span>
                <span class="font-semibold text-gray-700">{{ formatDate(domainInfo.expires) }}</span>
              </div>
            </div>
          </div>

          <div class="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Network</p>
            <div class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">IP:</span>
                <span class="font-semibold text-gray-700 font-mono">{{ domainInfo.ip }}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Region:</span>
                <span class="font-semibold text-gray-700">{{ getCountryName(domainInfo.country) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 bg-primary-50/50 rounded-xl border border-primary-100">
          <p class="text-[10px] font-bold text-primary-400 uppercase tracking-wider mb-2">Technical Details</p>
          <div class="space-y-2">
            <div>
              <p class="text-[11px] text-primary-600 font-medium">Registrar</p>
              <p class="text-sm font-semibold text-gray-800">{{ domainInfo.registrar }}</p>
            </div>
            <div>
              <p class="text-[11px] text-primary-600 font-medium">ASN</p>
              <p class="text-sm font-semibold text-gray-800 font-mono">{{ domainInfo.asn }}</p>
            </div>
            <div>
              <p class="text-[11px] text-primary-600 font-medium">DNS Servers</p>
              <div class="flex flex-wrap gap-1.5 mt-1">
                <span v-for="ns in formattedNS.primary" :key="ns" class="px-2 py-0.5 bg-white border border-primary-100 text-primary-700 text-[10px] font-mono rounded-md shadow-sm">
                  {{ ns }}
                </span>
                <span v-if="formattedNS.othersCount > 0" class="text-[10px] text-gray-400 font-medium self-center ml-1">
                  +{{ formattedNS.othersCount }} more
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 bg-gray-50 border-t border-gray-100 text-center">
      <p class="text-[10px] text-gray-400 font-medium">Domain Inspector+ v{{ version }} • Powered by Vercel API</p>
    </div>
  </div>
</template>

<style scoped>
  /* Стили компонента */
</style>
