#!/usr/bin/env node

/**
 * Скрипт для создания responsive версий изображений
 *
 * Создает 3 размера для каждого изображения:
 * - small (mobile): 480px ширина
 * - medium (tablet): 768px ширина
 * - large (desktop): 1920px ширина
 *
 * Установка:
 * npm install sharp
 *
 * Запуск:
 * node create-responsive-images.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Конфигурация размеров
const SIZES = {
    small: { width: 480, suffix: '-small' },
    medium: { width: 768, suffix: '-medium' },
    large: { width: 1920, suffix: '-large' }
};

// Качество для разных форматов
const QUALITY = {
    webp: 80,
    jpeg: 85
};

// Изображения для обработки (критичные, большие изображения)
const IMAGES_TO_PROCESS = [
    'images/hero-bg.jpg',
    'images/hero-bg.webp',
    'images/order-bg.jpg',
    'images/order-bg.webp',
    'images/services/selection.jpg',
    'images/services/detailing.jpg',
    'images/services/trade-in.jpg'
];

let stats = {
    total: 0,
    created: 0,
    errors: 0
};

/**
 * Создание responsive версий для одного изображения
 */
async function createResponsiveVersions(inputPath) {
    try {
        if (!fs.existsSync(inputPath)) {
            console.log(`⏭️  Пропущен (не существует): ${inputPath}`);
            return;
        }

        const ext = path.extname(inputPath);
        const baseName = path.basename(inputPath, ext);
        const dirName = path.dirname(inputPath);
        const isWebP = ext === '.webp';

        console.log(`\n📸 Обработка: ${inputPath}`);

        for (const [sizeName, config] of Object.entries(SIZES)) {
            const outputName = `${baseName}${config.suffix}${ext}`;
            const outputPath = path.join(dirName, outputName);

            // Пропустить если уже существует
            if (fs.existsSync(outputPath)) {
                console.log(`  ⏭️  ${sizeName}: уже существует`);
                continue;
            }

            // Создаем responsive версию
            const sharpInstance = sharp(inputPath)
                .resize(config.width, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                });

            if (isWebP) {
                await sharpInstance
                    .webp({ quality: QUALITY.webp })
                    .toFile(outputPath);
            } else {
                await sharpInstance
                    .jpeg({ quality: QUALITY.jpeg, progressive: true })
                    .toFile(outputPath);
            }

            const originalSize = fs.statSync(inputPath).size;
            const newSize = fs.statSync(outputPath).size;
            const savedPercent = ((originalSize - newSize) / originalSize * 100).toFixed(1);

            stats.created++;
            console.log(`  ✅ ${sizeName}: ${formatBytes(newSize)} (${savedPercent}% от оригинала)`);
        }

    } catch (error) {
        console.error(`❌ Ошибка при обработке ${inputPath}:`, error.message);
        stats.errors++;
    }
}

/**
 * Форматирование размера файла
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Основная функция
 */
async function main() {
    console.log('🚀 Создание responsive версий изображений...\n');
    console.log('📐 Размеры:');
    console.log(`  - Small (mobile):  ${SIZES.small.width}px`);
    console.log(`  - Medium (tablet): ${SIZES.medium.width}px`);
    console.log(`  - Large (desktop): ${SIZES.large.width}px`);
    console.log(`\n⚙️  Качество: WebP ${QUALITY.webp}%, JPEG ${QUALITY.jpeg}%`);

    stats.total = IMAGES_TO_PROCESS.length;

    // Обрабатываем каждое изображение
    for (const imagePath of IMAGES_TO_PROCESS) {
        await createResponsiveVersions(imagePath);
    }

    // Статистика
    console.log('\n' + '='.repeat(60));
    console.log('📈 ИТОГИ:');
    console.log('='.repeat(60));
    console.log(`Обработано файлов:   ${stats.total}`);
    console.log(`✅ Создано версий:   ${stats.created}`);
    console.log(`❌ Ошибок:           ${stats.errors}`);
    console.log('='.repeat(60));

    // Инструкции по использованию
    console.log('\n📝 КАК ИСПОЛЬЗОВАТЬ В HTML:\n');
    console.log(`<picture>
    <!-- Desktop -->
    <source media="(min-width: 1200px)"
            srcset="images/hero-bg-large.webp"
            type="image/webp">

    <!-- Tablet -->
    <source media="(min-width: 768px)"
            srcset="images/hero-bg-medium.webp"
            type="image/webp">

    <!-- Mobile -->
    <source srcset="images/hero-bg-small.webp"
            type="image/webp">

    <!-- Fallback -->
    <img src="images/hero-bg.jpg"
         alt="Автомобили премиум класса"
         loading="lazy">
</picture>`);

    console.log('\n✨ Готово!');
}

// Запуск
main().catch(console.error);
