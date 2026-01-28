# 🔍 Domain Inspector Plus

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285f4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Браузерное расширение для мгновенного получения технической и регистрационной информации о доменах и IP-адресах.

## ✨ Возможности

- ⚡ **Мгновенная проверка** - из 50 секунд в 2 секунды
- 🖱️ **Контекстное меню** - правый клик на любом домене
- 🔍 **Автоподсветка** - домены выделяются на странице
- 📋 **Копирование одним кликом** - вся информация в буфер
- 🎯 **Структурированные данные** - WHOIS, DNS, геолокация и др.

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- npm 9+
- Google Chrome

### Установка для разработки

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/domain-inspector-plus.git
cd domain-inspector-plus

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev:chrome

# Сборка для production
npm run build:chrome