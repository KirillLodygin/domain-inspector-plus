import browser from 'webextension-polyfill'
import { extractDomain, isValidDomain } from '@/lib/utils'

// Конфигурация
const CONFIG = {
  highlightClass: 'domain-inspector-highlight',
  popupClass: 'domain-inspector-popup',
  enabled: true,
  highlightColor: 'rgba(59, 130, 246, 0.1)',
  borderColor: '#3b82f6',
}

// Состояние
let observer: MutationObserver | null = null
let highlightedElements: HTMLElement[] = []
let activePopup: HTMLElement | null = null

/**
 * Находит все текстовые узлы с доменами
 */
function findDomainNodes(): { node: Node; domain: string }[] {
  const results: { node: Node; domain: string }[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)

  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.textContent && node.parentNode) {
      const text = node.textContent
      const words = text.split(/\s+/)

      for (const word of words) {
        const domain = extractDomain(word)
        if (domain && isValidDomain(domain)) {
          results.push({ node, domain })
          break // Нашли домен в этом узле, переходим к следующему
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
    `(?:https?:\\/\\/)?(?:www\\.)?(${domain.replace('.', '\\.')})(?![\\w-])`,
    'gi'
  )

  if (!regex.test(text)) return

  const span = document.createElement('span')
  span.className = CONFIG.highlightClass
  span.dataset.domain = domain
  span.dataset.originalText = text

  // Восстанавливаем текст с подсветкой
  span.innerHTML = text.replace(
    regex,
    match => `<span class="${CONFIG.highlightClass}-inner">${match}</span>`
  )

  node.parentNode.replaceChild(span, node)
  highlightedElements.push(span)

  // Добавляем обработчики событий
  span.addEventListener('mouseenter', handleDomainHover)
  span.addEventListener('mouseleave', handleDomainLeave)
  span.addEventListener('click', handleDomainClick)
}

/**
 * Обработчик наведения на домен
 */
function handleDomainHover(event: Event): void {
  const target = event.currentTarget as HTMLElement
  const domain = target.dataset.domain

  if (!domain) return

  // Показываем всплывающую подсказку
  showTooltip(target, domain)
}

/**
 * Обработчик ухода мыши с домена
 */
function handleDomainLeave(): void {
  hideTooltip()
}

/**
 * Обработчик клика по домену
 */
function handleDomainClick(event: Event): void {
  event.preventDefault()
  event.stopPropagation()

  const target = event.currentTarget as HTMLElement
  const domain = target.dataset.domain

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
function showTooltip(element: HTMLElement, domain: string): void {
  hideTooltip()

  const rect = element.getBoundingClientRect()
  const popup = document.createElement('div')
  popup.className = CONFIG.popupClass

  popup.innerHTML = `
    <div class="domain-tooltip">
      <div class="domain-name">${domain}</div>
      <div class="domain-action">Click to inspect</div>
    </div>
  `

  // Позиционирование
  popup.style.position = 'fixed'
  popup.style.left = `${rect.left + window.scrollX}px`
  popup.style.top = `${rect.top + window.scrollY - 40}px`
  popup.style.zIndex = '10000'

  document.body.appendChild(popup)
  activePopup = popup
}

/**
 * Скрывает всплывающую подсказку
 */
function hideTooltip(): void {
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

    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent) {
            const domain = extractDomain(node.textContent)
            if (domain && isValidDomain(domain)) {
              highlightDomain(node, domain)
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Рекурсивно обрабатываем добавленные элементы
            processElement(node as HTMLElement)
          }
        })
      }
    })
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
      position: relative;
      cursor: pointer;
    }
    
    .${CONFIG.highlightClass}-inner {
      background-color: ${CONFIG.highlightColor};
      border-bottom: 2px solid ${CONFIG.borderColor};
      padding: 0 2px;
      border-radius: 2px;
      transition: all 0.2s ease;
    }
    
    .${CONFIG.highlightClass}:hover .${CONFIG.highlightClass}-inner {
      background-color: rgba(59, 130, 246, 0.2);
    }
    
    .${CONFIG.popupClass} .domain-tooltip {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 8px 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      animation: fadeIn 0.2s ease;
    }
    
    .${CONFIG.popupClass} .domain-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
    }
    
    .${CONFIG.popupClass} .domain-action {
      color: #6b7280;
      font-size: 11px;
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
browser.runtime.onMessage.addListener(message => {
  if (message.type === 'TOGGLE_HIGHLIGHT') {
    CONFIG.enabled = message.enabled
    if (CONFIG.enabled) {
      initHighlighting()
    } else {
      cleanup()
    }
  }
})
