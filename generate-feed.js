#!/usr/bin/env node
/**
 * Генератор YML-фида для Яндекс Директ (Динамические объявления).
 * Читает cars.json и создаёт feed.yml в формате Yandex Market Language.
 *
 * Запуск: node generate-feed.js
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://amgautotrade.ru';
const SHOP_NAME = 'AMG Auto Trade';
const COMPANY = 'ООО «АМГ АВТО-ТРЕЙД»';

const carsPath = path.join(__dirname, 'cars.json');
const feedPath = path.join(__dirname, 'feed.yml');

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatPrice(price) {
    return Math.round(price);
}

function buildDescription(car) {
    const parts = [];
    if (car.year) parts.push(car.year + ' г.');
    if (car.engineType) parts.push(car.engineType.toLowerCase());
    if (car.engineVolume) parts.push(car.engineVolume + ' л');
    if (car.power) parts.push(car.power + ' л.с.');
    if (car.transmission) parts.push(car.transmission.toLowerCase());
    if (car.drive) parts.push(car.drive.toLowerCase() + ' привод');
    if (car.mileage !== undefined) {
        parts.push(car.mileage > 100 ? `пробег ${car.mileage.toLocaleString('ru-RU')} км` : 'новый');
    }
    if (car.color) parts.push(car.color);
    return parts.join(', ');
}

function generateFeed(cars) {
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 16);

    // Собираем уникальные бренды для категорий
    const brands = [...new Set(cars.map(c => c.brand))].sort();
    const brandCategories = {};
    brands.forEach((brand, i) => {
        brandCategories[brand] = i + 2; // ID 1 = Автомобили, 2+ = бренды
    });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<yml_catalog date="${dateStr}">\n`;
    xml += `  <shop>\n`;
    xml += `    <name>${escapeXml(SHOP_NAME)}</name>\n`;
    xml += `    <company>${escapeXml(COMPANY)}</company>\n`;
    xml += `    <url>${SITE_URL}</url>\n`;
    xml += `    <phone>+7 (499) 490-70-30</phone>\n`;
    xml += `    <currencies>\n`;
    xml += `      <currency id="RUR" rate="1"/>\n`;
    xml += `    </currencies>\n`;

    // Категории
    xml += `    <categories>\n`;
    xml += `      <category id="1">Автомобили</category>\n`;
    for (const brand of brands) {
        xml += `      <category id="${brandCategories[brand]}" parentId="1">${escapeXml(brand)}</category>\n`;
    }
    xml += `    </categories>\n`;

    // Товары
    xml += `    <offers>\n`;
    for (const car of cars) {
        if (!car.price || !car.brand) continue;

        const offerId = car.vin || `car-${cars.indexOf(car)}`;
        const url = `${SITE_URL}/catalog.html?brand=${encodeURIComponent(car.brand)}&model=${encodeURIComponent(car.model)}`;
        const title = `${car.brand} ${car.model}${car.generation ? ' ' + car.generation : ''}, ${car.year}`;
        const categoryId = brandCategories[car.brand] || 1;

        xml += `      <offer id="${escapeXml(offerId)}" available="true">\n`;
        xml += `        <name>${escapeXml(title)}</name>\n`;
        xml += `        <url>${escapeXml(url)}</url>\n`;
        xml += `        <price>${formatPrice(car.price)}</price>\n`;
        xml += `        <currencyId>RUR</currencyId>\n`;
        xml += `        <categoryId>${categoryId}</categoryId>\n`;

        // Фото (макс 10 для фида)
        if (car.photos && car.photos.length > 0) {
            const photos = car.photos.slice(0, 10);
            for (const photo of photos) {
                xml += `        <picture>${escapeXml(photo)}</picture>\n`;
            }
        }

        xml += `        <description>${escapeXml(buildDescription(car))}</description>\n`;
        xml += `        <vendor>${escapeXml(car.brand)}</vendor>\n`;
        xml += `        <model>${escapeXml(car.model)}</model>\n`;

        // Параметры
        if (car.year) xml += `        <param name="Год выпуска">${car.year}</param>\n`;
        if (car.mileage !== undefined) xml += `        <param name="Пробег">${car.mileage} км</param>\n`;
        if (car.engineType) xml += `        <param name="Двигатель">${escapeXml(car.engineType)}</param>\n`;
        if (car.engineVolume) xml += `        <param name="Объём двигателя">${car.engineVolume} л</param>\n`;
        if (car.power) xml += `        <param name="Мощность">${car.power} л.с.</param>\n`;
        if (car.transmission) xml += `        <param name="Коробка передач">${escapeXml(car.transmission)}</param>\n`;
        if (car.drive) xml += `        <param name="Привод">${escapeXml(car.drive)}</param>\n`;
        if (car.bodyType) xml += `        <param name="Кузов">${escapeXml(car.bodyType)}</param>\n`;
        if (car.color) xml += `        <param name="Цвет">${escapeXml(car.color)}</param>\n`;
        if (car.vehicleType) xml += `        <param name="Состояние">${escapeXml(car.vehicleType)}</param>\n`;
        if (car.modification) xml += `        <param name="Модификация">${escapeXml(car.modification)}</param>\n`;

        xml += `      </offer>\n`;
    }

    xml += `    </offers>\n`;
    xml += `  </shop>\n`;
    xml += `</yml_catalog>\n`;

    return xml;
}

// Main
try {
    const raw = fs.readFileSync(carsPath, 'utf-8');
    const cars = JSON.parse(raw);
    console.log(`Загружено ${cars.length} авто из cars.json`);

    const feed = generateFeed(cars);
    fs.writeFileSync(feedPath, feed, 'utf-8');
    console.log(`YML-фид записан в ${feedPath}`);
    console.log(`Категорий: ${[...new Set(cars.map(c => c.brand))].length}`);
    console.log(`Товаров: ${cars.filter(c => c.price && c.brand).length}`);
} catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
}
