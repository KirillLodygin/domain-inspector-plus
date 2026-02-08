import browser from 'webextension-polyfill'
import { extractDomain, isValidDomain, formatDate } from '@/lib/utils'
import { inspectDomain } from '@/lib/api'

// Конфигурация
const CONFIG = {
  highlightClass: 'highlight',
  popupClass: 'domain-inspector-popup',
  enabled: true,
}

// Состояние
let observer: MutationObserver | null = null
let highlightedElements: HTMLElement[] = []
let activePopup: HTMLElement | null = null
let hideTimeout: number | null = null
let hoverTimeout: number | null = null
let mutationTimeout: number | null = null
let scrollListener: ((event: Event) => void) | null = null
let targetElement: HTMLElement | null = null

/**
 * Дебаунс для обработки изменений DOM
 */
/**
 * Показывает индикатор отключения на ограниченных сайтах
 */
function showDisabledIndicator(hostname: string): void {
  // Проверяем, не показан ли уже индикатор
  if (document.querySelector('#domain-inspector-disabled-indicator')) {
    return
  }

  const indicator = document.createElement('div')
  indicator.id = 'domain-inspector-disabled-indicator'
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fbbf24;
    color: #78350f;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: opacity 0.3s ease;
    cursor: pointer;
  `
  indicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 6px;">
      <span>🔍</span>
      <span>Domain Inspector disabled on ${hostname}</span>
    </div>
  `

  // Добавляем обработчик для закрытия
  indicator.addEventListener('click', () => {
    indicator.style.opacity = '0'
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator)
      }
    }, 300)
  })

  document.body.appendChild(indicator)

  // Автоматически скрываем через 5 секунд
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0'
      setTimeout(() => {
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator)
        }
      }, 300)
    }
  }, 5000)
}

function debouncedHighlight(): void {
  if (mutationTimeout) {
    clearTimeout(mutationTimeout)
  }
  mutationTimeout = window.setTimeout(() => {
    findDomainNodes()
    mutationTimeout = null
  }, 500)
}
function findDomainNodes(): void {
  // Полное отключение на code-хостингах и других проблемных сайтах
  const restrictedSites = [
    'github.com', 'gitlab.com', 'bitbucket.org', 'git.sr.ht',
    'sourceforge.net', 'codeberg.org', 'gitea.io', 'gogs.io',
    'stackoverflow.com', 'serverfault.com', 'superuser.com',
    'reddit.com', 'discord.com', 'slack.com', 'twitter.com',
    'x.com', 'facebook.com', 'linkedin.com', 'instagram.com'
  ]

  const currentHost = window.location.hostname
  const isRestrictedSite = restrictedSites.some(site => 
    currentHost === site || currentHost.endsWith('.' + site)
  )

  if (isRestrictedSite) {
    // Показываем индикатор, что расширение отключено
    showDisabledIndicator(currentHost)
    return // Полностью отключаем подсветку на этих сайтах
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
  // Регулярное выражение для доменов
  const domainRegex = /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}(?:\.[a-z]{2,})?\b/gi

  const nodesToProcess: Node[] = []
  let node: Node | null
  let totalNodes = 0
  let skippedNodes = 0
  let processedNodes = 0

  while ((node = walker.nextNode())) {
    totalNodes++
    const text = node.textContent
    if (!text || text.length < 4) {
      skippedNodes++
      continue
    }

    const parent = node.parentNode as HTMLElement
    if (!parent || parent.closest(`.${CONFIG.highlightClass}`) || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'].includes(parent.tagName) || parent.isContentEditable) {
      skippedNodes++
      continue
    }

    // Простая проверка на файлы - исключаем только очевидные файлы
    const trimmedText = text.trim()
    const fileExtensions = [
      'js', 'json', 'ts', 'tsx', 'jsx', 'css', 'scss',
      'html', 'md', 'txt', 'sh', 'py', 'java', 'cpp',
      'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
      'scala', 'clj', 'hs', 'ml', 'elm', 'dart',
      'lua', 'r', 'sql', 'graphql', 'yaml', 'yml',
      'toml', 'ini', 'cfg', 'conf', 'xml', 'csv',
      'log', 'tmp', 'bak', 'old', 'orig', 'swp', 'swo',
    ]

    // Проверяем, что это именно файл с расширением, а не домен
    const isFile = fileExtensions.some(ext => {
      const filePattern = new RegExp(`\\.${ext}$`, 'i')
      return filePattern.test(trimmedText) && !/\.[a-z]{2,}(?:\.[a-z]{2,})?\b/i.test(trimmedText)
    })

    if (isFile) {
      skippedNodes++
      continue
    }

    // Проверяем, содержит ли текст домены
    if (domainRegex.test(text)) {
      // Теперь подсвечиваем домены даже в ссылках
      nodesToProcess.push(node)
      processedNodes++
    } else {
      skippedNodes++
    }
  }
  
  nodesToProcess.forEach(node => highlightInNode(node, domainRegex))
}

function highlightInNode(node: Node, regex: RegExp): void {
  const text = node.textContent
  if (!text || !node.parentNode) return

  regex.lastIndex = 0
  if (!regex.test(text)) {
    return
  }

  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  let domainsFound = 0

  regex.lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    // Добавляем текст до домена
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }

    const domain = match[0]
    const span = document.createElement('span')
    span.className = CONFIG.highlightClass
    span.style.cssText = `
      background-color: rgba(34, 197, 94, 0.1);
      color: #16a34a;
      border-radius: 3px;
      padding: 1px 3px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: underline;
      text-decoration-color: rgba(34, 197, 94, 0.3);
      text-underline-offset: 2px;
    `
    span.dataset.originalText = domain
    span.dataset.domain = domain // Важно: добавляем domain в dataset!
    span.textContent = domain

    span.addEventListener('mouseenter', handleDomainHover)
    span.addEventListener('mouseleave', handleDomainLeave)
    span.addEventListener('click', e => handleDomainClick(e, domain.toLowerCase()))

    fragment.appendChild(span)
    highlightedElements.push(span)

    domainsFound++
    lastIndex = regex.lastIndex
  }

  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
  }

  // Заменяем оригинальный узел
  const parent = node.parentNode
  if (parent) {
    parent.replaceChild(fragment, node)
  }
}

/**
 * Обработчики событий для доменов
 */
function handleDomainHover(event: Event): void {
  const target = event.target as HTMLElement
  const domain = target.dataset.domain

  if (!domain) {
    return
  }

  // Очищаем предыдущие таймауты
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  // Уменьшаем задержку показа tooltip
  hoverTimeout = window.setTimeout(() => {
    showTooltip(target, domain)
  }, 100)
}

function handleDomainLeave(event: Event): void {
  // Очищаем таймаут показа
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }

  // Скрываем tooltip с задержкой
  hideTimeout = window.setTimeout(() => {
    hideTooltip()
  }, 100)
}

/**
 * Обработчик клика по домену
 */
function handleDomainClick(event: Event, domainOverride?: string): void {
  // Проверяем модификаторы клика
  const mouseEvent = event as MouseEvent

  // Если клик с модификаторами (Ctrl, Cmd, Shift, Alt), не обрабатываем
  if (mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey || mouseEvent.altKey) {
    return
  }

  // Если это правый клик или средний клик, не обрабатываем
  if (mouseEvent.button !== 0) {
    return
  }

  const target = event.target as HTMLElement
  const domain = domainOverride || target.dataset.domain

  if (!domain) {
    return
  }

  // Если клик по tooltip - уже обработано в отдельном обработчике
  if (target.closest('.domain-inspector-popup')) {
    return
  }

  // Проверяем, кликнута ли ссылка
  const isLinkClick = target.tagName === 'A' || target.closest('a')
  
  if (isLinkClick) {
    // Для ссылок - не блокируем переход, не открываем popup
    return
  }

  // Для обычных доменов (не в ссылках) - стандартная обработка
  event.preventDefault()
  event.stopPropagation()

  // Отправляем сообщение в background script
  browser.runtime
    .sendMessage({
      type: 'INSPECT_DOMAIN',
      domain,
      source: 'click',
    })
    .then(response => {
      // Response handling
    })
    .catch(error => {
      console.error('Content script: Failed to send message:', error)
    })
}

/**
 * Показывает всплывающую подсказку
 */
async function showTooltip(element: HTMLElement, domain: string): Promise<void> {
  if (activePopup) {
    if (activePopup.dataset.domain === domain) {
      return
    }
    hideTooltip()
  }

  targetElement = element

  const rect = element.getBoundingClientRect()

  // Проверяем и добавляем CSS стили если нужно
  if (!document.querySelector('#domain-inspector-tooltip-styles')) {
    const style = document.createElement('style')
    style.id = 'domain-inspector-tooltip-styles'
    style.textContent = `
      .${CONFIG.popupClass} {
        position: absolute;
        z-index: 10000;
        background: #16a34a;
        border: none;
        border-radius: 6px;
        padding: 6px 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      
      .${CONFIG.popupClass}:hover {
        background: #15803d;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      }
      
      .${CONFIG.popupClass} .inspect-btn {
        background: transparent;
        color: white;
        border: none;
        padding: 0;
        margin: 0;
        font: inherit;
        cursor: pointer;
      }
      
      .tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
      }
      
      .${CONFIG.popupClass}.arrow-top .tooltip-arrow {
        top: -5px;
        left: 10px; /* Смещаем вправо для нижнего позиционирования */
        transform: none;
        border-bottom: 5px solid #16a34a;
      }
      
      .${CONFIG.popupClass}.arrow-bottom .tooltip-arrow {
        bottom: -5px;
        right: 10px; /* Смещаем вправо для верхнего позиционирования */
        transform: none;
        border-top: 5px solid #16a34a;
      }
      
      /* Добавляем невидимую буферную зону вокруг tooltip */
      .${CONFIG.popupClass}::before {
        content: '';
        position: absolute;
        top: -10px;
        left: -10px;
        right: -10px;
        bottom: -10px;
        z-index: -1;
      }
    `
    document.head.appendChild(style)
  }

  const popup = document.createElement('div')
  popup.className = CONFIG.popupClass
  popup.dataset.domain = domain

  // Обработчики для самого попапа, чтобы он не закрывался при наведении
  popup.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
  })
  popup.addEventListener('mouseleave', () => {
    hideTimeout = window.setTimeout(() => {
      hideTooltip()
    }, 200)
  })

  // Функция обновления позиции
  const updatePosition = () => {
    if (!popup || !targetElement) {
      return
    }

    const currentRect = targetElement.getBoundingClientRect()
    const popupWidth = 240
    const popupHeight = 40
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    // Начальная позиция - под элементом с отступом
    let left = currentRect.left + scrollLeft + 10 // Смещаем вправо
    let top = currentRect.bottom + scrollTop + 8 // Увеличиваем отступ снизу
    let arrowClass = 'arrow-top'

    // Проверяем, не выходит ли tooltip за пределы экрана
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 20
    }

    if (top + popupHeight > window.innerHeight) {
      // Если не помещается внизу, показываем сверху с минимальным отступом
      top = currentRect.top + scrollTop - popupHeight + 2 // Минимальный отступ сверху
      left = currentRect.left + scrollLeft - 10 // Смещаем влево
      arrowClass = 'arrow-bottom'
      
      // Дополнительная проверка для верхнего позиционирования
      if (left < 0) {
        left = 10 // Минимальный отступ слева
      }
    }

    popup.style.position = 'absolute'
    popup.style.left = `${left}px`
    popup.style.top = `${top}px`
    popup.style.zIndex = '10000'

    // Обновляем класс стрелки
    popup.className = `${CONFIG.popupClass} ${arrowClass}`
  }

  // Начальное состояние - только кнопка Inspect
  popup.innerHTML = `
    <button class="inspect-btn">Inspect</button>
    <div class="tooltip-arrow"></div>
  `

  // Добавляем popup в DOM
  document.body.appendChild(popup)
  activePopup = popup
  targetElement = element

  // Начальное позиционирование ПОСЛЕ добавления в DOM
  updatePosition()

  // Добавляем слушатель скролла
  scrollListener = () => {
    updatePosition()
  }
  window.addEventListener('scroll', scrollListener, { passive: true })
  window.addEventListener('resize', scrollListener, { passive: true })

  // Обработчик кнопки инспекции - теперь сам popup является кнопкой
  popup.addEventListener('click', e => {
    e.stopPropagation()
    e.preventDefault()
    
    // Отправляем сообщение в background script для открытия popup
    browser.runtime
      .sendMessage({
        type: 'INSPECT_DOMAIN',
        domain,
        source: 'tooltip',
      })
      .then(response => {
        // Response handling
      })
      .catch(error => {
        console.error('Content script: Failed to send tooltip message:', error)
      })
    
    hideTooltip()
  })
}

/**
 * Скрывает всплывающую подсказку
 */
function hideTooltip(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  // Удаляем слушатели скролла
  if (scrollListener) {
    window.removeEventListener('scroll', scrollListener)
    window.removeEventListener('resize', scrollListener)
    scrollListener = null
  }

  // Сбрасываем ссылку на элемент
  targetElement = null

  if (activePopup && activePopup.parentNode) {
    activePopup.parentNode.removeChild(activePopup)
    activePopup = null
  }
}

/**
 * Инициализация подсветки
 */
function initHighlighting(): void {
  if (!CONFIG.enabled) return

  // Находим и подсвечиваем все домены
  findDomainNodes()

  // Наблюдаем за изменениями DOM
  observer = new MutationObserver(mutations => {
    if (!CONFIG.enabled) return

    let shouldUpdate = false
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldUpdate = true
      }
    })

    if (shouldUpdate) {
      debouncedHighlight()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Добавляем стили
  addStyles()
}

function addStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    .highlight {
      background-color: rgba(34, 197, 94, 0.1);
      border-bottom: 2px solid #22c55e;
      cursor: pointer;
      border-radius: 2px;
      padding: 0 1px;
      transition: background-color 0.2s;
    }
    
    .highlight:hover {
      background-color: rgba(34, 197, 94, 0.2);
    }
    
    .${CONFIG.popupClass} {
      position: fixed;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .domain-tooltip {
      background: rgba(71, 135, 77, 0.85);
      color: white;
      border-radius: 6px;
      padding: 8px 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: fadeIn 0.15s ease-out;
      position: relative;
      backdrop-filter: blur(4px);
    }

    .domain-tooltip::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 20px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid rgba(71, 135, 77, 0.85);
    }

    .tooltip-arrow-top::after {
      bottom: auto;
      top: -6px;
      border-top: none;
      border-bottom: 6px solid rgba(71, 135, 77, 0.85);
    }

    .tooltip-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .domain-name {
      font-weight: 600;
      color: white;
      white-space: nowrap;
    }
    
    .inspect-btn {
      background-color: #22c55e;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .inspect-btn:hover {
      background-color: #16a34a;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `

  document.head.appendChild(style)
}

/**
 * Очистка подсветки
 */
function cleanup(): void {
  // Очищаем observer
  if (observer) {
    observer.disconnect()
    observer = null
  }

  // Удаляем подсветку
  highlightedElements.forEach(el => {
    const parent = el.parentNode
    if (parent && el.dataset.originalText) {
      parent.replaceChild(document.createTextNode(el.dataset.originalText), el)
    }
  })
  highlightedElements = []

  // Скрываем tooltip
  hideTooltip()

  // Очищаем все таймауты
  if (mutationTimeout) {
    clearTimeout(mutationTimeout)
    mutationTimeout = null
  }

  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
}

/**
 * Перезапускает подсветку
 */
function restart(): void {
  cleanup()
  initHighlighting()
}

// Инициализация при загрузке
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHighlighting)
} else {
  initHighlighting()
}

// Экспортируем функции для отладки
if (typeof window !== 'undefined') {
  ;(window as any).DomainInspector = {
    restart,
    cleanup,
    findDomainNodes,
  }
}

// Обработка сообщений от background script
browser.runtime.onMessage.addListener((message: any) => {
  if (message.type === 'TOGGLE_HIGHLIGHT') {
    CONFIG.enabled = message.enabled
    if (CONFIG.enabled) {
      initHighlighting()
    } else {
      cleanup()
    }
  }
})
