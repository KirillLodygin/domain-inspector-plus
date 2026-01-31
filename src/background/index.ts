import browser from 'webextension-polyfill'

// Состояние расширения
const state = {
  contextMenuId: 'inspect-domain',
  lastDomain: '',
  isEnabled: true,
}

/**
 * Инициализация расширения
 */
async function initialize(): Promise<void> {
  console.log('Domain Inspector Plus initializing...')

  // Загружаем сохраненные настройки
  const result = await browser.storage.local.get(['isEnabled', 'apiEndpoint'])
  state.isEnabled = result.isEnabled ?? true

  // Создаем контекстное меню
  createContextMenu()

  // Устанавливаем слушатели
  setupListeners()

  console.log('Domain Inspector Plus initialized')
}

/**
 * Создает контекстное меню
 */
function createContextMenu(): void {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: state.contextMenuId,
      title: 'Inspect domain: %s',
      contexts: ['selection', 'link'],
    })
  })
}

/**
 * Настраивает слушатели событий
 */
function setupListeners(): void {
  // Контекстное меню
  browser.contextMenus.onClicked.addListener(handleContextMenuClick)

  // Сообщения от content script и popup
  browser.runtime.onMessage.addListener(handleRuntimeMessage)

  // Обновление вкладок
  browser.tabs.onUpdated.addListener(handleTabUpdate)

  // Установка/обновление
  browser.runtime.onInstalled.addListener(handleInstall)
}

/**
 * Обработчик клика по контекстному меню
 */
async function handleContextMenuClick(
  info: browser.Menus.OnClickData,
  tab?: browser.Tabs.Tab
): Promise<void> {
  if (info.menuItemId !== state.contextMenuId || !tab?.id) return

  let domain = ''

  if (info.selectionText) {
    domain = extractDomainFromText(info.selectionText)
  } else if (info.linkUrl) {
    domain = extractDomainFromUrl(info.linkUrl)
  }

  if (!domain) {
    console.warn('No domain found in selection')
    return
  }

  // Сохраняем домен для popup
  state.lastDomain = domain
  await browser.storage.local.set({ lastDomain: domain })

  // Открываем popup
  try {
    await browser.action.openPopup()
  } catch (error) {
    console.warn('Could not open popup automatically')
    // Fallback: показываем уведомление
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: 'Domain Inspector',
      message: `Right-click the extension icon to inspect ${domain}`,
    })
  }
}

/**
 * Обработчик runtime сообщений
 */
function handleRuntimeMessage(
  message: any,
  sender: browser.Runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  console.log('Background received message:', message)

  switch (message.type) {
    case 'INSPECT_DOMAIN':
      handleInspectDomain(message.domain, sender.tab?.id)
      break

    case 'GET_LAST_DOMAIN':
      browser.storage.local.get('lastDomain').then((result: any) => {
        sendResponse({ domain: result.lastDomain || '' })
      })
      return true

    case 'TOGGLE_FEATURE':
      state.isEnabled = message.enabled
      browser.storage.local.set({ isEnabled: message.enabled })

      // Отправляем обновление во все вкладки
      browser.tabs.query({}).then((tabs: any[]) => {
        tabs.forEach((tab: any) => {
          if (tab.id) {
            browser.tabs
              .sendMessage(tab.id, {
                type: 'TOGGLE_HIGHLIGHT',
                enabled: message.enabled,
              })
              .catch(() => {
                // Игнорируем ошибки для вкладок без content script
              })
          }
        })
      })
      break

    case 'GET_STATE':
      sendResponse({
        isEnabled: state.isEnabled,
        lastDomain: state.lastDomain,
      })
      break
  }

  return true // Сообщаем, что sendResponse будет вызван асинхронно
}

/**
 * Обработчик запроса на инспекцию домена
 */
async function handleInspectDomain(domain: string, tabId?: number): Promise<void> {
  console.log('Inspecting domain:', domain)

  state.lastDomain = domain
  await browser.storage.local.set({ lastDomain: domain })

  // Обновляем badge
  if (tabId) {
    await browser.action.setBadgeText({
      text: '✓',
      tabId,
    })

    await browser.action.setBadgeBackgroundColor({
      color: '#10B981',
      tabId,
    })

    // Сбрасываем badge через 3 секунды
    setTimeout(() => {
      browser.action
        .setBadgeText({
          text: '',
          tabId,
        })
        .catch(() => {})
    }, 3000)
  }

  // Открываем popup
  try {
    await (browser.action as any).openPopup()
  } catch (error) {
    console.warn('Could not open popup automatically, showing notification')
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.png'),
      title: 'Domain Inspector+',
      message: `Domain ${domain} is ready for inspection. Click the extension icon.`,
    })
  }
}

/**
 * Обработчик обновления вкладки
 */
function handleTabUpdate(
  tabId: number,
  changeInfo: browser.Tabs.OnUpdatedChangeInfoType,
  tab: browser.Tabs.Tab
): void {
  if (changeInfo.status === 'complete') {
    // Сбрасываем badge при загрузке новой страницы
    browser.action
      .setBadgeText({
        text: '',
        tabId,
      })
      .catch(() => {})
  }
}

/**
 * Обработчик установки/обновления
 */
function handleInstall(details: browser.Runtime.OnInstalledDetailsType): void {
  console.log('Extension installed/updated:', details.reason)

  if (details.reason === 'install') {
    // Первая установка - открываем welcome страницу
    browser.tabs.create({
      url: browser.runtime.getURL('welcome.html'),
    })
  }

  // Сбрасываем состояние
  browser.storage.local.set({
    isEnabled: true,
    apiEndpoint: '',
    lastDomain: '',
  })
}

/**
 * Извлекает домен из текста
 */
function extractDomainFromText(text: string): string {
  // Упрощенная регулярка для MVP
  const domainRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/i
  const match = text.match(domainRegex)
  return match ? match[0].replace(/^https?:\/\//, '').replace(/^www\./, '') : ''
}

/**
 * Извлекает домен из URL
 */
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Генерирует тестовые данные домена (для разработки)
 */
function getMockDomainInfo(domain: string): any {
  const domains: Record<string, any> = {
    'google.com': {
      domain: 'google.com',
      created: '1997-09-15',
      expires: '2028-09-14',
      registrar: 'MarkMonitor Inc.',
      ip: '142.250.185.78',
      country: 'United States',
      as: 'AS15169 Google LLC',
      ns1: 'ns1.google.com',
      ns2: 'ns2.google.com',
    },
    'github.com': {
      domain: 'github.com',
      created: '2007-10-09',
      expires: '2024-10-09',
      registrar: 'MarkMonitor Inc.',
      ip: '140.82.112.4',
      country: 'United States',
      as: 'AS36459 GitHub, Inc.',
      ns1: 'ns-1283.awsdns-32.org',
      ns2: 'ns-1707.awsdns-21.co.uk',
    },
    'example.com': {
      domain: 'example.com',
      created: '1992-01-01',
      expires: '2024-01-01',
      registrar: 'IANA',
      ip: '93.184.216.34',
      country: 'United States',
      as: 'AS15133 EdgeCast Networks',
      ns1: 'a.iana-servers.net',
      ns2: 'b.iana-servers.net',
    },
  }

  return (
    domains[domain] || {
      domain,
      created: 'N/A',
      expires: 'N/A',
      registrar: 'N/A',
      ip: 'N/A',
      country: 'N/A',
      as: 'N/A',
      ns1: 'N/A',
      ns2: 'N/A',
    }
  )
}

// Запуск инициализации
initialize().catch(console.error)

// Экспортируем для тестов
if (typeof module !== 'undefined') {
  module.exports = {
    extractDomainFromText,
    extractDomainFromUrl,
    getMockDomainInfo,
  }
}
