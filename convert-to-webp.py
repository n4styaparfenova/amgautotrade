#!/usr/bin/env python3
"""
Скрипт для конвертации всех изображений в WebP формат

Установка зависимостей:
pip install Pillow

Запуск:
python3 convert-to-webp.py
"""

import os
import glob
from pathlib import Path
from PIL import Image

# Настройки конвертации
CONFIG = {
    # Качество WebP (1-100, рекомендуется 75-85)
    'quality': 80,
    # Папки для обработки
    'folders': [
        'images/**/*.jpg',
        'images/**/*.jpeg',
        'images/**/*.png',
    ]
}

# Счетчики статистики
stats = {
    'total': 0,
    'converted': 0,
    'skipped': 0,
    'errors': 0,
    'saved_bytes': 0
}


def format_bytes(bytes_value):
    """Форматирование байтов в читаемый формат"""
    if bytes_value == 0:
        return '0 Bytes'

    k = 1024
    sizes = ['Bytes', 'KB', 'MB', 'GB']
    i = 0
    while bytes_value >= k and i < len(sizes) - 1:
        bytes_value /= k
        i += 1

    return f"{bytes_value:.2f} {sizes[i]}"


def convert_to_webp(input_path):
    """Конвертация одного файла в WebP"""
    try:
        # Формируем путь для WebP файла
        output_path = str(Path(input_path).with_suffix('.webp'))

        # Пропустить, если WebP уже существует
        if os.path.exists(output_path):
            print(f"⏭️  Пропущен (уже существует): {output_path}")
            stats['skipped'] += 1
            return

        # Получаем размер оригинального файла
        original_size = os.path.getsize(input_path)

        # Открываем и конвертируем изображение
        with Image.open(input_path) as img:
            # Конвертируем в RGB, если нужно (для PNG с прозрачностью)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаем белый фон для изображений с прозрачностью
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Сохраняем в WebP
            img.save(output_path, 'WEBP', quality=CONFIG['quality'], method=6)

        # Получаем размер нового файла
        new_size = os.path.getsize(output_path)
        saved_bytes = original_size - new_size
        saved_percent = (saved_bytes / original_size * 100) if original_size > 0 else 0

        stats['saved_bytes'] += saved_bytes
        stats['converted'] += 1

        print(f"✅ Конвертирован: {os.path.basename(input_path)} → {os.path.basename(output_path)}")
        print(f"   Размер: {format_bytes(original_size)} → {format_bytes(new_size)} (экономия {saved_percent:.1f}%)")

    except Exception as error:
        print(f"❌ Ошибка при конвертации {input_path}: {str(error)}")
        stats['errors'] += 1


def main():
    """Основная функция"""
    print('🚀 Начинаем конвертацию изображений в WebP...\n')
    print(f"⚙️  Качество: {CONFIG['quality']}")
    print(f"📁 Папки для обработки: {', '.join(CONFIG['folders'])}\n")

    # Собираем все файлы
    all_files = []
    for pattern in CONFIG['folders']:
        files = glob.glob(pattern, recursive=True)
        all_files.extend(files)

    # Убираем дубликаты
    all_files = list(set(all_files))
    stats['total'] = len(all_files)

    print(f"📊 Найдено файлов для обработки: {stats['total']}\n")

    if stats['total'] == 0:
        print('⚠️  Нет файлов для обработки')
        return

    # Обрабатываем каждый файл
    for file_path in all_files:
        convert_to_webp(file_path)

    # Выводим статистику
    print('\n' + '=' * 60)
    print('📈 ИТОГИ:')
    print('=' * 60)
    print(f"Всего файлов:        {stats['total']}")
    print(f"✅ Конвертировано:   {stats['converted']}")
    print(f"⏭️  Пропущено:        {stats['skipped']}")
    print(f"❌ Ошибок:           {stats['errors']}")
    print(f"💾 Сэкономлено:      {format_bytes(stats['saved_bytes'])}")

    if stats['converted'] > 0:
        avg_saved = stats['saved_bytes'] / stats['converted']
        print(f"📊 Средняя экономия: {format_bytes(avg_saved)} на файл")

    print('=' * 60)
    print('\n✨ Готово!')


if __name__ == '__main__':
    main()
