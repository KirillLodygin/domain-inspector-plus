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
let mutationTimeout: number | null = null
let scrollListener: ((event: Event) => void) | null = null
let targetElement: HTMLElement | null = null

/**
 * Дебаунс для обработки изменений DOM
 */
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
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
  const domainRegex = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;

  const nodesToProcess: Node[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent
    if (!text || text.length < 4) continue
    
    const parent = node.parentNode as HTMLElement
    if (!parent || parent.closest(`.${CONFIG.highlightClass}`) || 
        ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'].includes(parent.tagName) ||
        parent.isContentEditable) {
      continue
    }

    nodesToProcess.push(node)
  }

  nodesToProcess.forEach(node => highlightInNode(node, domainRegex))
}

function highlightInNode(node: Node, regex: RegExp): void {
  const text = node.textContent
  if (!text || !node.parentNode) return

  regex.lastIndex = 0
  if (!regex.test(text)) return

  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  let match

  regex.lastIndex = 0
  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
    }

    const domain = match[0]
    const span = document.createElement('span')
    span.className = CONFIG.highlightClass
    span.dataset.domain = domain.toLowerCase()
    span.dataset.originalText = domain
    span.textContent = domain

    span.addEventListener('mouseenter', handleDomainHover)
    span.addEventListener('mouseleave', handleDomainLeave)
    span.addEventListener('click', (e) => handleDomainClick(e, domain.toLowerCase()))

    fragment.appendChild(span)
    highlightedElements.push(span)
    lastIndex = regex.lastIndex
  }

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

  if (!domain) {
    console.error('No domain found for click')
    return
  }

  console.log('Content script: Sending INSPECT_DOMAIN message for:', domain)

  // Отправляем сообщение в background script
  browser.runtime
    .sendMessage({
      type: 'INSPECT_DOMAIN',
      domain,
      source: 'click',
    })
    .then((response) => {
      console.log('Content script: Message response:', response)
    })
    .catch((error) => {
      console.error('Content script: Failed to send message:', error)
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

  // Сохраняем ссылку на элемент
  targetElement = element

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

  // Функция обновления позиции
  const updatePosition = () => {
    if (!popup.parentNode || !targetElement) return

    const currentRect = targetElement.getBoundingClientRect()
    const popupWidth = 240
    const popupHeight = 40
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

    // Вычисляем позицию с учетом скролла
    let left = currentRect.left + scrollLeft
    let top = currentRect.top + scrollTop - popupHeight - 10
    let arrowClass = ''

    // Проверка границ экрана
    if (left + popupWidth > window.innerWidth) {
      left = window.innerWidth - popupWidth - 20
    }
    
    if (top < scrollTop) {
      top = currentRect.top + scrollTop + currentRect.height + 10
      arrowClass = 'tooltip-arrow-top'
    }

    popup.style.position = 'absolute'
    popup.style.left = `${left}px`
    popup.style.top = `${top}px`

    // Обновляем класс стрелки
    const tooltip = popup.querySelector('.domain-tooltip') as HTMLElement
    if (tooltip) {
      tooltip.className = `domain-tooltip ${arrowClass}`
    }
  }

  // Начальное состояние
  popup.innerHTML = `
    <div class="domain-tooltip">
      <div class="tooltip-content">
        <div class="domain-name">${domain}</div>
        <button class="inspect-btn">Inspect</button>
      </div>
    </div>
  `

  // Добавляем в DOM ПЕРЕД позиционированием
  document.body.appendChild(popup)
  activePopup = popup

  // Начальное позиционирование ПОСЛЕ добавления в DOM
  updatePosition()

  // Добавляем слушатель скролла
  scrollListener = () => {
    updatePosition()
  }
  window.addEventListener('scroll', scrollListener, { passive: true })
  window.addEventListener('resize', scrollListener, { passive: true })

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
