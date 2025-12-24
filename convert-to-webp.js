#!/usr/bin/env node

/**
 * Скрипт для конвертации всех изображений в WebP формат
 *
 * Установка зависимостей:
 * npm install sharp glob
 *
 * Запуск:
 * node convert-to-webp.js
 */

const sharp = require('sharp');
const glob = require('glob');
const path = require('path');
const fs = require('fs');

// Настройки конвертации
const CONFIG = {
    // Качество WebP (0-100, рекомендуется 75-85)
    quality: 80,
    // Папки для обработки
    folders: [
        'images/**/*.{jpg,jpeg,png}',
        'images/brands/**/*.{jpg,jpeg,png}',
        'images/services/**/*.{jpg,jpeg,png}',
        'cars/**/*.{jpg,jpeg,png}'
    ],
    // Исключить определенные файлы/папки
    ignore: [
        '**/*.webp',
        '**/node_modules/**'
    ]
};

// Счетчики статистики
let stats = {
    total: 0,
    converted: 0,
    skipped: 0,
    errors: 0,
    savedBytes: 0
};

/**
 * Конвертация одного файла в WebP
 */
async function convertToWebP(inputPath) {
    try {
        const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');

        // Пропустить, если WebP уже существует
        if (fs.existsSync(outputPath)) {
            console.log(`⏭️  Пропущен (уже существует): ${outputPath}`);
            stats.skipped++;
            return;
        }

        // Получаем размер оригинального файла
        const originalStats = fs.statSync(inputPath);
        const originalSize = originalStats.size;

        // Конвертируем
        await sharp(inputPath)
            .webp({ quality: CONFIG.quality })
            .toFile(outputPath);

        // Получаем размер нового файла
        const newStats = fs.statSync(outputPath);
        const newSize = newStats.size;
        const savedBytes = originalSize - newSize;
        const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

        stats.savedBytes += savedBytes;
        stats.converted++;

        console.log(`✅ Конвертирован: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
        console.log(`   Размер: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (экономия ${savedPercent}%)`);

    } catch (error) {
        console.error(`❌ Ошибка при конвертации ${inputPath}:`, error.message);
        stats.errors++;
    }
}

/**
 * Форматирование байтов в читаемый формат
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Основная функция
 */
async function main() {
    console.log('🚀 Начинаем конвертацию изображений в WebP...\n');
    console.log(`⚙️  Качество: ${CONFIG.quality}`);
    console.log(`📁 Папки для обработки: ${CONFIG.folders.join(', ')}\n`);

    // Собираем все файлы
    let allFiles = [];
    for (const pattern of CONFIG.folders) {
        const files = glob.sync(pattern, { ignore: CONFIG.ignore });
        allFiles = allFiles.concat(files);
    }

    // Убираем дубликаты
    allFiles = [...new Set(allFiles)];
    stats.total = allFiles.length;

    console.log(`📊 Найдено файлов для обработки: ${stats.total}\n`);

    if (stats.total === 0) {
        console.log('⚠️  Нет файлов для обработки');
        return;
    }

    // Обрабатываем каждый файл
    for (const file of allFiles) {
        await convertToWebP(file);
    }

    // Выводим статистику
    console.log('\n' + '='.repeat(60));
    console.log('📈 ИТОГИ:');
    console.log('='.repeat(60));
    console.log(`Всего файлов:        ${stats.total}`);
    console.log(`✅ Конвертировано:   ${stats.converted}`);
    console.log(`⏭️  Пропущено:        ${stats.skipped}`);
    console.log(`❌ Ошибок:           ${stats.errors}`);
    console.log(`💾 Сэкономлено:      ${formatBytes(stats.savedBytes)}`);

    if (stats.converted > 0) {
        const avgSaved = stats.savedBytes / stats.converted;
        console.log(`📊 Средняя экономия: ${formatBytes(avgSaved)} на файл`);
    }

    console.log('='.repeat(60));
    console.log('\n✨ Готово!');
}

// Запускаем скрипт
main().catch(console.error);
