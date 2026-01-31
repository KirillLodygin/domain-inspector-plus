import browser from 'webextension-polyfill'
import { extractDomain, isValidDomain, formatDate } from '@/lib/utils'
import { inspectDomain } from '@/lib/api'

// Конфигурация
const CONFIG = {
  highlightClass: 'domain-highlight',
  popupClass: 'domain-inspector-popup',
  enabled: true,
}

// Состояние
let observer: MutationObserver | null = null
let highlightedElements: HTMLElement[] = []
let activePopup: HTMLElement | null = null
let hideTimeout: number | null = null
let mutationTimeout: number | null = null

/**
 * Дебаунс для обработки изменений DOM
 */
function debouncedHighlight(): void {
  if (mutationTimeout) {
    clearTimeout(mutationTimeout)
  }
  mutationTimeout = window.setTimeout(() => {
    const domainNodes = findDomainNodes()
    domainNodes.forEach(({ node, domain }) => {
      highlightDomain(node, domain)
    })
    mutationTimeout = null
  }, 500)
}
function findDomainNodes(): { node: Node; domain: string }[] {
  const results: { node: Node; domain: string }[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
  const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent && node.parentNode && !(node.parentNode as HTMLElement).closest(`.${CONFIG.highlightClass}`)) {
      const text = node.textContent
      if (domainRegex.test(text)) {
        const match = text.match(domainRegex);
        if (match) {
          results.push({ node, domain: extractDomain(match[0]) || '' })
        }
      }
    }
  }

  return results
}

/**
 * Подсвечивает домен в текстовом узле
 */
function highlightDomain(node: Node, domain: string): void {
  if (!node.parentNode || node.nodeType !== Node.TEXT_NODE) return

  const text = node.textContent || ''
  const regex = new RegExp(
    `((?:https?:\\/\\/)?(?:www\\.)?${domain.replace('.', '\\.')}(?![\\w-]))`,
    'gi'
  )

  if (!regex.test(text)) return

  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  let match

  regex.lastIndex = 0 // Reset regex
  while ((match = regex.exec(text)) !== null) {
    // Текст до совпадения
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }

    // Подсвеченный домен
    const span = document.createElement('span')
    span.className = CONFIG.highlightClass
    span.dataset.domain = domain
    span.dataset.originalText = match[0]
    span.textContent = match[0]

    // Добавляем обработчики событий
    span.addEventListener('mouseenter', handleDomainHover)
    span.addEventListener('mouseleave', handleDomainLeave)
    span.addEventListener('click', (e) => handleDomainClick(e, domain))

    fragment.appendChild(span)
    highlightedElements.push(span)
    lastIndex = regex.lastIndex
  }

  // Оставшийся текст
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
  }

  node.parentNode.replaceChild(fragment, node)
}

/**
 * Обработчик наведения на домен
 */
function handleDomainHover(event: Event): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  const target = event.currentTarget as HTMLElement
  const domain = target.dataset.domain

  if (!domain) return

  // Показываем всплывающую подсказку
  showTooltip(target, domain)
}

/**
 * Обработчик ухода мыши с домена
 */
function handleDomainLeave(event: MouseEvent): void {
  const relatedTarget = event.relatedTarget as HTMLElement;
  if (relatedTarget && relatedTarget.closest(`.${CONFIG.popupClass}`)) {
    return;
  }

  hideTimeout = window.setTimeout(() => {
    hideTooltip()
  }, 300)
}

/**
 * Обработчик клика по домену
 */
function handleDomainClick(event: Event, domainOverride?: string): void {
  event.preventDefault()
  event.stopPropagation()

  const target = event.currentTarget as HTMLElement
  const domain = domainOverride || target.dataset.domain

  if (!domain) return

  // Отправляем сообщение в background script
  browser.runtime
    .sendMessage({
      type: 'INSPECT_DOMAIN',
      domain,
      source: 'click',
    })
    .catch(() => {
      // Игнорируем ошибки, если расширение не готово
    })
}

/**
 * Показывает всплывающую подсказку
 */
async function showTooltip(element: HTMLElement, domain: string): Promise<void> {
  if (activePopup) {
    if (activePopup.dataset.domain === domain) return
    hideTooltip()
  }

  const rect = element.getBoundingClientRect()
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
    }, 300)
  })

  // Позиционирование
  const popupWidth = 240
  const popupHeight = 40
  let left = rect.left + window.scrollX
  let top = rect.top + window.scrollY - popupHeight - 10
  let arrowClass = '';

  // Проверка границ экрана
  if (left + popupWidth > window.innerWidth) {
    left = window.innerWidth - popupWidth - 20
  }
  
  if (top < window.scrollY) {
    top = rect.top + window.scrollY + rect.height + 10
    arrowClass = 'tooltip-arrow-top';
  }

  popup.style.position = 'fixed'
  popup.style.left = `${left}px`
  popup.style.top = `${top}px`
  popup.style.zIndex = '2147483647'

  // Начальное состояние
  popup.innerHTML = `
    <div class="domain-tooltip ${arrowClass}">
      <div class="tooltip-content">
        <div class="domain-name">${domain}</div>
        <button class="inspect-btn">Inspect</button>
      </div>
    </div>
  `

  document.body.appendChild(popup)
  activePopup = popup

  // Обработчик кнопки инспекции
  const inspectBtn = popup.querySelector('.inspect-btn')
  inspectBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    handleDomainClick(e, domain)
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
  const domainNodes = findDomainNodes()
  domainNodes.forEach(({ node, domain }) => {
    highlightDomain(node, domain)
  })

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

/**
 * Обрабатывает элемент рекурсивно
 */
function processElement(element: HTMLElement): void {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent) {
      const domain = extractDomain(node.textContent)
      if (domain && isValidDomain(domain)) {
        highlightDomain(node, domain)
      }
    }
  }
}

/**
 * Добавляет CSS стили
 */
function addStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    .${CONFIG.highlightClass} {
      background-color: rgba(59, 130, 246, 0.1);
      border-bottom: 2px solid #3b82f6;
      cursor: pointer;
      border-radius: 2px;
      padding: 0 1px;
      transition: background-color 0.2s;
    }
    
    .${CONFIG.highlightClass}:hover {
      background-color: rgba(59, 130, 246, 0.2);
    }
    
    .${CONFIG.popupClass} {
      position: fixed;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .domain-tooltip {
      background: #1f2937;
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
    }

    .domain-tooltip::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 20px;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #1f2937;
    }

    .tooltip-arrow-top::after {
      bottom: auto;
      top: -6px;
      border-top: none;
      border-bottom: 6px solid #1f2937;
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
      background-color: #3b82f6;
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
      background-color: #2563eb;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `

  document.head.appendChild(style)
}

/**
 * Очищает все подсветки
 */
function cleanup(): void {
  highlightedElements.forEach(element => {
    if (element.parentNode && element.dataset.originalText) {
      const textNode = document.createTextNode(element.dataset.originalText)
      element.parentNode.replaceChild(textNode, element)
    }
  })

  highlightedElements = []

  if (observer) {
    observer.disconnect()
    observer = null
  }

  hideTooltip()
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
