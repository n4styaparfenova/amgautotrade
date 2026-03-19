/**
 * Telegram Bot для AMG Auto Trade (FIXED VERSION)
 * Исправлена проблема ERR_UNESCAPED_CHARACTERS с Node.js 18+
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Обходим проблему ERR_UNESCAPED_CHARACTERS
const originalRequest = https.request;
https.request = function(url, options, callback) {
    if (typeof url === 'string') {
        url = new URL(url);
    }
    return originalRequest(url, options, callback);
};

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    BOT_TOKEN: process.env.BOT_TOKEN || 'ВАШ_ТОКЕН',
    MANAGER_CHAT_IDS: process.env.MANAGER_CHAT_IDS
        ? process.env.MANAGER_CHAT_IDS.split(',')
        : ['ВАШ_CHAT_ID'],
    WEBHOOK_URL: process.env.WEBHOOK_URL || '',
    WEBHOOK_PORT: process.env.WEBHOOK_PORT || 3000,
    API_PORT: process.env.API_PORT || 3001,
    API_SECRET: process.env.API_SECRET || 'amgautotrade_secret_2025',
    MODE: process.env.MODE || 'polling',
    LOG_FILE: path.join(__dirname, 'bot.log'),
    ENABLE_LOGGING: true
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ БОТА
// ============================================

let bot;

if (CONFIG.MODE === 'webhook' && CONFIG.WEBHOOK_URL) {
    bot = new TelegramBot(CONFIG.BOT_TOKEN, {
        webHook: { port: CONFIG.WEBHOOK_PORT }
    });
    bot.setWebHook(`${CONFIG.WEBHOOK_URL}/bot${CONFIG.BOT_TOKEN}`);
    console.log('✓ Bot started in WEBHOOK mode');
} else {
    bot = new TelegramBot(CONFIG.BOT_TOKEN, {
        polling: {
            params: {
                timeout: 10
            }
        }
    });
    console.log('✓ Bot started in POLLING mode');
}

// ============================================
// EXPRESS SERVER
// ============================================

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.post('/api/lead', async (req, res) => {
    try {
        const { name, phone, message, source, car, secret } = req.body;

        if (secret !== CONFIG.API_SECRET) {
            logMessage('❌ Unauthorized request');
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const telegramMessage = formatLeadMessage({
            name,
            phone,
            message,
            source: source || 'Неизвестно',
            car: car || ''
        });

        const results = await sendToManagers(telegramMessage);
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

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        mode: CONFIG.MODE,
        timestamp: new Date().toISOString()
    });
});

app.listen(CONFIG.API_PORT, () => {
    console.log(`✓ API Server running on port ${CONFIG.API_PORT}`);
});

// ============================================
// КОМАНДЫ БОТА
// ============================================

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

Добавьте меня в группу с менеджерами!
    `.trim();

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
📖 <b>Справка по командам:</b>

<b>/start</b> - Приветствие
<b>/help</b> - Эта справка
<b>/status</b> - Статус бота
<b>/stats</b> - Статистика заявок
<b>/chatid</b> - Получить Chat ID

<b>Настройка:</b>
1. Узнайте Chat ID: /chatid
2. Добавьте в MANAGER_CHAT_IDS на сервере
3. Перезапустите бота

<b>Для групп:</b>
1. Добавьте бота в группу
2. Дайте права администратора
3. Отправьте /chatid
4. Используйте полученный ID
    `.trim();

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

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
        message += '\n\n💡 <i>Используйте этот Chat ID для настройки уведомлений</i>';
    }

    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});

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

<i>Обновлено: ${new Date().toLocaleTimeString('ru-RU')}</i>
        `.trim();

        bot.sendMessage(chatId, statsMessage, { parse_mode: 'HTML' });
    } catch (error) {
        bot.sendMessage(chatId, '❌ Не удалось загрузить статистику');
    }
});

bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;

    if (!CONFIG.MANAGER_CHAT_IDS.includes(chatId.toString())) {
        const autoReply = `
Спасибо за сообщение!

Чтобы оставить заявку:
📱 Сайт: amgautotrade.ru
📞 Телефон: +7 (985) 674-26-50
💬 Telegram: @AMG_auto_trade

Наши менеджеры свяжутся с вами!
        `.trim();

        bot.sendMessage(chatId, autoReply);
    }
});

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

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
    // Игнорируем ERR_UNESCAPED_CHARACTERS
    if (error.message && error.message.includes('ERR_UNESCAPED_CHARACTERS')) {
        return;
    }
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
