/**
 * Telegram Bot для AMG Auto Trade
 *
 * Функции:
 * - Прием заявок с сайта
 * - Отправка уведомлений менеджерам
 * - Команды для управления ботом
 * - Автоответы клиентам
 * - Логирование всех действий
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    // Telegram Bot Token (получите у @BotFather)
    BOT_TOKEN: process.env.BOT_TOKEN || 'ВАШ_НОВЫЙ_ТОКЕН',

    // Chat ID менеджеров (куда отправлять заявки)
    MANAGER_CHAT_IDS: process.env.MANAGER_CHAT_IDS
        ? process.env.MANAGER_CHAT_IDS.split(',')
        : ['ВАШ_CHAT_ID'],

    // Webhook settings (для продакшена)
    WEBHOOK_URL: process.env.WEBHOOK_URL || '',
    WEBHOOK_PORT: process.env.WEBHOOK_PORT || 3000,

    // API settings (для приема заявок с сайта)
    API_PORT: process.env.API_PORT || 3001,
    API_SECRET: process.env.API_SECRET || 'amgautotrade_secret_2025',

    // Режим работы (polling или webhook)
    MODE: process.env.MODE || 'polling',

    // Логирование
    LOG_FILE: path.join(__dirname, 'bot.log'),
    ENABLE_LOGGING: true
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ БОТА
// ============================================

let bot;

if (CONFIG.MODE === 'webhook' && CONFIG.WEBHOOK_URL) {
    // Webhook режим (для продакшена на VPS с доменом)
    bot = new TelegramBot(CONFIG.BOT_TOKEN, {
        webHook: {
            port: CONFIG.WEBHOOK_PORT
        }
    });
    bot.setWebHook(`${CONFIG.WEBHOOK_URL}/bot${CONFIG.BOT_TOKEN}`);
    console.log('✓ Bot started in WEBHOOK mode');
} else {
    // Polling режим (простой, работает везде)
    bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });
    console.log('✓ Bot started in POLLING mode');
}

// ============================================
// EXPRESS SERVER ДЛЯ ПРИЕМА ЗАЯВОК С САЙТА
// ============================================

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Endpoint для приема заявок с сайта
app.post('/api/lead', async (req, res) => {
    try {
        const { name, phone, message, source, car, secret } = req.body;

        // Проверка секретного ключа
        if (secret !== CONFIG.API_SECRET) {
            logMessage('❌ Unauthorized request');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Валидация
        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Формируем сообщение
        const telegramMessage = formatLeadMessage({
            name,
            phone,
            message,
            source: source || 'Неизвестно',
            car: car || ''
        });

        // Отправляем всем менеджерам
        const results = await sendToManagers(telegramMessage);

        // Логируем
        logMessage(`✓ New lead: ${name} - ${phone}`);

        res.json({
            success: true,
            message: 'Lead received',
            sent_to: results.length
        });

    } catch (error) {
        console.error('Error processing lead:', error);
        logMessage(`❌ Error: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        mode: CONFIG.MODE,
        timestamp: new Date().toISOString()
    });
});

// Запуск API сервера
app.listen(CONFIG.API_PORT, () => {
    console.log(`✓ API Server running on port ${CONFIG.API_PORT}`);
});

// ============================================
// КОМАНДЫ БОТА
// ============================================

// /start - Приветствие
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'друг';

    const welcomeMessage = `
👋 Привет, ${userName}!

Я бот AMG Auto Trade для приема заявок с сайта.

<b>Доступные команды:</b>
/help - Помощь
/status - Статус бота
/stats - Статистика
/chatid - Узнать ваш Chat ID

<b>Что я умею:</b>
✓ Принимать заявки с сайта
✓ Моментально уведомлять менеджеров
✓ Логировать все обращения
✓ Отвечать на базовые вопросы

Добавьте меня в группу с менеджерами, чтобы все получали уведомления!
    `.trim();

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

// /help - Помощь
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
📖 <b>Справка по командам:</b>

<b>/start</b> - Приветствие и информация
<b>/help</b> - Эта справка
<b>/status</b> - Проверить статус бота
<b>/stats</b> - Статистика заявок
<b>/chatid</b> - Получить ваш Chat ID

<b>Настройка уведомлений:</b>
1. Узнайте свой Chat ID командой /chatid
2. Добавьте его в переменную MANAGER_CHAT_IDS на сервере
3. Перезапустите бота

<b>Для групп:</b>
1. Добавьте бота в группу
2. Дайте права администратора
3. Отправьте /chatid в группе
4. Используйте полученный ID (начинается с минуса)
    `.trim();

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

// /status - Статус
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;

    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    const statusMessage = `
✅ <b>Бот работает нормально</b>

⏱ <b>Uptime:</b> ${hours}ч ${minutes}м
🔧 <b>Режим:</b> ${CONFIG.MODE}
📡 <b>API Port:</b> ${CONFIG.API_PORT}
👥 <b>Менеджеров:</b> ${CONFIG.MANAGER_CHAT_IDS.length}
📅 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}

<b>Node.js:</b> ${process.version}
<b>Memory:</b> ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
    `.trim();

    bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
});

// /chatid - Получить Chat ID
bot.onText(/\/chatid/, async (msg) => {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const chatTitle = msg.chat.title || msg.from.first_name;

    let message = `
🆔 <b>Информация о чате:</b>

<b>Chat ID:</b> <code>${chatId}</code>
<b>Тип:</b> ${chatType}
<b>Название:</b> ${chatTitle}
    `.trim();

    if (chatType === 'group' || chatType === 'supergroup') {
        message += '\n\n💡 <i>Используйте этот Chat ID для настройки уведомлений в группе</i>';
    }

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

// /stats - Статистика
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const logs = await fs.readFile(CONFIG.LOG_FILE, 'utf-8');
        const lines = logs.split('\n');

        const today = new Date().toISOString().split('T')[0];
        const todayLeads = lines.filter(line =>
            line.includes('✓ New lead') && line.includes(today)
        ).length;

        const totalLeads = lines.filter(line =>
            line.includes('✓ New lead')
        ).length;

        const statsMessage = `
📊 <b>Статистика заявок:</b>

📅 <b>Сегодня:</b> ${todayLeads}
📈 <b>Всего:</b> ${totalLeads}
⏱ <b>Работает:</b> ${Math.floor(process.uptime() / 3600)}ч

<i>Последнее обновление: ${new Date().toLocaleTimeString('ru-RU')}</i>
        `.trim();

        bot.sendMessage(chatId, statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
        bot.sendMessage(chatId, '❌ Не удалось загрузить статистику');
    }
});

// ============================================
// ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ
// ============================================

bot.on('message', (msg) => {
    // Игнорируем команды
    if (msg.text && msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;

    // Если это не менеджер и не группа, отправляем автоответ
    if (!CONFIG.MANAGER_CHAT_IDS.includes(chatId.toString())) {
        const autoReply = `
Спасибо за сообщение!

Я бот для приема заявок. Чтобы оставить заявку на автомобиль:
📱 Перейдите на сайт: amgautotrade.ru
📞 Позвоните: +7 (495) 990-49-34
💬 Telegram: @AMG_auto_trade

Наши менеджеры свяжутся с вами в ближайшее время!
        `.trim();

        bot.sendMessage(chatId, autoReply);
    }
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Форматирование сообщения о заявке
 */
function formatLeadMessage({ name, phone, message, source, car }) {
    let msg = '🚗 <b>НОВАЯ ЗАЯВКА С САЙТА</b>\n\n';
    msg += `👤 <b>Имя:</b> ${escapeHtml(name)}\n`;
    msg += `📞 <b>Телефон:</b> <code>${escapeHtml(phone)}</code>\n`;

    if (car) {
        msg += `🚘 <b>Автомобиль:</b> ${escapeHtml(car)}\n`;
    }

    if (message) {
        msg += `💬 <b>Комментарий:</b> ${escapeHtml(message)}\n`;
    }

    msg += `\n📍 <b>Источник:</b> ${escapeHtml(source)}\n`;
    msg += `🕐 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}\n`;
    msg += '\n<i>⚡ Перезвоните клиенту в течение 5 минут!</i>';

    return msg;
}

/**
 * Отправка сообщения всем менеджерам
 */
async function sendToManagers(message) {
    const results = [];

    for (const chatId of CONFIG.MANAGER_CHAT_IDS) {
        try {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            results.push({ chatId, success: true });
        } catch (error) {
            console.error(`Failed to send to ${chatId}:`, error.message);
            results.push({ chatId, success: false, error: error.message });
        }
    }

    return results;
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Логирование
 */
async function logMessage(message) {
    if (!CONFIG.ENABLE_LOGGING) return;

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    try {
        await fs.appendFile(CONFIG.LOG_FILE, logEntry);
    } catch (error) {
        console.error('Failed to write log:', error);
    }
}

// ============================================
// ОБРАБОТКА ОШИБОК
// ============================================

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
    logMessage(`❌ Polling error: ${error.message}`);
});

bot.on('webhook_error', (error) => {
    console.error('Webhook error:', error.message);
    logMessage(`❌ Webhook error: ${error.message}`);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    logMessage(`❌ Uncaught exception: ${error.message}`);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    logMessage(`❌ Unhandled rejection: ${error}`);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await bot.stopPolling();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await bot.stopPolling();
    process.exit(0);
});

// ============================================
// STARTUP MESSAGE
// ============================================

console.log(`
╔═══════════════════════════════════════════╗
║   AMG Auto Trade Telegram Bot Started    ║
╚═══════════════════════════════════════════╝

Mode: ${CONFIG.MODE}
API Port: ${CONFIG.API_PORT}
Managers: ${CONFIG.MANAGER_CHAT_IDS.length}
Time: ${new Date().toLocaleString('ru-RU')}

Ready to receive leads! 🚗
`);

logMessage('✓ Bot started successfully');
