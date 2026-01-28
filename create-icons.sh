#!/bin/bash

echo "🎨 Создание иконок для Domain Inspector Plus..."

# Определяем пути
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ICONS_DIR="$PROJECT_ROOT/public/icons"

echo "📁 Корень проекта: $PROJECT_ROOT"
echo "📁 Директория иконок: $ICONS_DIR"

# Создаем директорию для иконок
mkdir -p "$ICONS_DIR"

# Переходим в директорию иконок
cd "$ICONS_DIR" || {
    echo "❌ Не удалось перейти в $ICONS_DIR"
    exit 1
}

echo "📂 Текущая директория: $(pwd)"

# Размеры иконок для Chrome расширения
sizes=(16 19 32 38 48 128)

# Цвета
background="#3b82f6"  # Основной синий Tailwind
foreground="#ffffff"  # Белый

echo "📱 Создание основных иконок..."
for size in "${sizes[@]}"; do
    # Рассчитываем размер текста
    if [ $size -le 32 ]; then
        fontsize=$((size / 2))
        text="D"
    elif [ $size -le 48 ]; then
        fontsize=$((size / 3))
        text="DI"
    else
        fontsize=$((size / 4))
        text="DIP"
    fi

    # Создаем квадратную иконку
    output_file="icon-${size}.png"

    echo "  🎯 Создаю $output_file (${size}x${size})..."
    convert -size ${size}x${size} xc:"$background" \
        -fill "$foreground" \
        -font "Arial-Bold" \
        -pointsize $fontsize \
        -gravity center \
        -draw "text 0,0 '$text'" \
        "$output_file"

    # Проверяем создание
    if [ -f "$output_file" ]; then
        echo "  ✅ Успешно создан: $output_file"
    else
        echo "  ❌ Ошибка при создании: $output_file"
    fi
done

# Создаем фавикон .ico (Windows)
echo "🪟 Создание .ico файла..."
convert icon-16.png icon-32.png icon-48.png favicon.ico 2>/dev/null || {
    echo "  ⚠️  Не удалось создать .ico файл (пропускаем)"
}

# Создаем apple-touch-icon (для мобильных)
echo "📱 Создание Apple Touch Icon..."
convert -size 180x180 xc:"$background" \
    -fill "$foreground" \
    -font "Arial-Bold" \
    -pointsize 45 \
    -gravity center \
    -draw "text 0,0 'DIP'" \
    apple-touch-icon.png

# Возвращаемся в корень проекта
cd "$PROJECT_ROOT"

echo ""
echo "✅ Все иконки созданы!"
echo "📁 Расположение: $ICONS_DIR/"
echo ""
echo "📋 Список созданных файлов:"
ls -la "$ICONS_DIR"/*.png "$ICONS_DIR"/*.ico 2>/dev/null | head -20
echo ""
echo "📝 Для использования в manifest.json:"
cat << EOF
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png"
    }
  }
EOF

# Проверяем существование иконок
echo ""
echo "🔍 Проверка созданных иконок:"
for size in 16 32 48 128; do
    if [ -f "$ICONS_DIR/icon-${size}.png" ]; then
        echo "  ✅ icon-${size}.png: существует"
    else
        echo "  ❌ icon-${size}.png: отсутствует!"
    fi
done