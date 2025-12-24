# 🚀 Развертывание Telegram Бота на VPS

## ⚠️ ВАЖНО: Безопасность токена

**ВЫ ОПУБЛИКОВАЛИ ТОКЕН ПУБЛИЧНО!** Срочно создайте новый:

1. Откройте Telegram → @BotFather
2. `/mybots` → выберите бота
3. "API Token" → "Revoke current token"
4. Скопируйте НОВЫЙ токен (никому не показывайте!)

---

## 📋 Что включено в бота:

✅ **Прием заявок с сайта** через REST API
✅ **Отправка уведомлений** всем менеджерам
✅ **Команды управления** (/start, /help, /status, /stats, /chatid)
✅ **Автоответы** клиентам
✅ **Логирование** всех действий
✅ **Автоперезапуск** при сбоях
✅ **Мониторинг** через PM2 или systemd

---

## 🖥 Требования к VPS:

- **OS:** Ubuntu 20.04/22.04 или Debian 11+
- **RAM:** Минимум 512 MB (рекомендуется 1 GB)
- **CPU:** 1 ядро
- **Disk:** 5 GB
- **Node.js:** 16.x или выше

---

## 🚀 РАЗВЕРТЫВАНИЕ НА VPS

### Шаг 1: Подключитесь к VPS

```bash
ssh root@ваш-ip-адрес
```

### Шаг 2: Установите Node.js

```bash
# Обновите систему
apt update && apt upgrade -y

# Установите Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Проверьте установку
node --version  # Должно быть v18.x.x
npm --version   # Должно быть 9.x.x
```

### Шаг 3: Установите PM2 (Process Manager)

```bash
npm install -g pm2
```

### Шаг 4: Создайте директорию для проекта

```bash
mkdir -p /root/amgautotrade
cd /root/amgautotrade
```

### Шаг 5: Загрузите файлы бота

**Вариант А: Git (если используете репозиторий)**

```bash
# Установите git
apt install -y git

# Клонируйте репозиторий
git clone https://ваш-репозиторий.git
cd telegram-bot
```

**Вариант Б: Ручная загрузка (через SFTP)**

```bash
# Используйте FileZilla, WinSCP или scp:
# Загрузите папку telegram-bot в /root/amgautotrade/
```

**Вариант В: Создайте файлы напрямую**

```bash
mkdir telegram-bot
cd telegram-bot

# Создайте bot.js
nano bot.js
# Скопируйте содержимое из локального bot.js
# Ctrl+O для сохранения, Ctrl+X для выхода

# Создайте package.json
nano package.json
# Скопируйте содержимое

# И так далее для остальных файлов
```

### Шаг 6: Настройте .env файл

```bash
cd /root/amgautotrade/telegram-bot

# Создайте .env файл
nano .env
```

Вставьте (замените на свои значения):

```env
# ТОКЕН БОТА (получите НОВЫЙ у @BotFather!)
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# CHAT ID менеджеров
# Узнайте командой /chatid в боте
MANAGER_CHAT_IDS=123456789,987654321

# Режим работы
MODE=polling

# API настройки
API_PORT=3001
API_SECRET=amgautotrade_secret_2025_смените_это
```

Сохраните: `Ctrl+O`, `Enter`, `Ctrl+X`

### Шаг 7: Установите зависимости

```bash
npm install
```

### Шаг 8: Протестируйте бота

```bash
# Запустите в тестовом режиме
node bot.js
```

Вы должны увидеть:
```
✓ Bot started in POLLING mode
✓ API Server running on port 3001

╔═══════════════════════════════════════════╗
║   AMG Auto Trade Telegram Bot Started    ║
╚═══════════════════════════════════════════╝
```

**Проверьте в Telegram:**
1. Напишите боту `/start`
2. Отправьте `/chatid` - скопируйте ваш Chat ID
3. Добавьте этот ID в .env → MANAGER_CHAT_IDS

Нажмите `Ctrl+C` чтобы остановить тест.

---

## 🔄 АВТОЗАПУСК (выберите один метод)

### Метод 1: PM2 (рекомендуется)

```bash
# Запустите бота через PM2
pm2 start bot.js --name amg-bot

# Сохраните конфигурацию
pm2 save

# Настройте автозапуск при перезагрузке
pm2 startup
# Выполните команду, которую покажет PM2

# Полезные команды:
pm2 list          # Список процессов
pm2 logs amg-bot  # Просмотр логов
pm2 restart amg-bot  # Перезапуск
pm2 stop amg-bot  # Остановка
pm2 monit         # Мониторинг в реальном времени
```

### Метод 2: Systemd Service

```bash
# Скопируйте service файл
cp amg-bot.service /etc/systemd/system/

# Отредактируйте пути если нужно
nano /etc/systemd/system/amg-bot.service

# Перезагрузите systemd
systemctl daemon-reload

# Запустите сервис
systemctl start amg-bot

# Добавьте в автозагрузку
systemctl enable amg-bot

# Проверьте статус
systemctl status amg-bot

# Полезные команды:
systemctl restart amg-bot  # Перезапуск
systemctl stop amg-bot     # Остановка
journalctl -u amg-bot -f   # Просмотр логов
```

---

## 🌐 НАСТРОЙКА NGINX (опционально)

Если хотите использовать webhook вместо polling:

```bash
# Установите Nginx
apt install -y nginx

# Создайте конфиг
nano /etc/nginx/sites-available/amg-bot
```

Вставьте:

```nginx
server {
    listen 80;
    server_name bot.amgautotrade.ru;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Сохраните и активируйте:

```bash
ln -s /etc/nginx/sites-available/amg-bot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

Установите SSL (Let's Encrypt):

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d bot.amgautotrade.ru
```

Обновите .env:

```env
MODE=webhook
WEBHOOK_URL=https://bot.amgautotrade.ru
WEBHOOK_PORT=3000
```

---

## 📡 ОБНОВЛЕНИЕ telegram-bot.php на сайте

Теперь PHP скрипт должен отправлять заявки в Node.js бот:

```php
<?php
// telegram-bot.php (НОВАЯ ВЕРСИЯ для работы с Node.js ботом)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Настройки
$NODE_BOT_URL = 'http://localhost:3001/api/lead';  // URL вашего Node.js бота
$API_SECRET = 'amgautotrade_secret_2025_смените_это';  // Тот же что в .env

// Получаем данные
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Валидация
if (empty($data['name']) || empty($data['phone'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing fields']);
    exit;
}

// Подготавливаем данные для отправки в бота
$payload = [
    'name' => $data['name'],
    'phone' => $data['phone'],
    'message' => $data['message'] ?? '',
    'source' => 'Главная страница',
    'car' => $data['car'] ?? '',
    'secret' => $API_SECRET
];

// Отправляем в Node.js бота
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $NODE_BOT_URL);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    echo json_encode(['success' => true, 'message' => 'Заявка принята']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>
```

Загрузите этот файл на хостинг, заменив старый telegram-bot.php.

---

## 🧪 ТЕСТИРОВАНИЕ

### 1. Проверьте бота в Telegram:

```
/start - Должен ответить приветствием
/status - Показать статус
/chatid - Получить ваш Chat ID
```

### 2. Проверьте API:

```bash
# На VPS выполните:
curl -X POST http://localhost:3001/api/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тест",
    "phone": "+7 (999) 123-45-67",
    "message": "Тестовая заявка",
    "source": "Тест",
    "secret": "amgautotrade_secret_2025_смените_это"
  }'
```

Должно прийти сообщение в Telegram!

### 3. Проверьте с сайта:

Откройте сайт, заполните форму, отправьте.
Заявка должна прийти в Telegram!

---

## 📊 МОНИТОРИНГ

### PM2 Monitoring:

```bash
pm2 monit         # Интерактивный мониторинг
pm2 list          # Список процессов
pm2 logs amg-bot  # Логи в реальном времени
```

### Systemd Logs:

```bash
journalctl -u amg-bot -f          # Логи в реальном времени
journalctl -u amg-bot --since today  # Логи за сегодня
```

### Файл логов бота:

```bash
tail -f /root/amgautotrade/telegram-bot/bot.log
```

---

## 🔧 ОБСЛУЖИВАНИЕ

### Обновление бота:

```bash
cd /root/amgautotrade/telegram-bot

# Если используете git:
git pull

# Установите новые зависимости:
npm install

# Перезапустите:
pm2 restart amg-bot
# или
systemctl restart amg-bot
```

### Очистка логов:

```bash
# PM2 логи
pm2 flush

# Системные логи
journalctl --vacuum-time=7d  # Оставить только за 7 дней

# Логи бота
> /root/amgautotrade/telegram-bot/bot.log
```

### Резервное копирование:

```bash
# Создайте бэкап
tar -czf amg-bot-backup-$(date +%Y%m%d).tar.gz /root/amgautotrade/telegram-bot

# Скачайте на локальный компьютер:
scp root@ваш-ip:/root/amg-bot-backup-*.tar.gz ~/Downloads/
```

---

## 🐛 РЕШЕНИЕ ПРОБЛЕМ

### Бот не запускается:

```bash
# Проверьте логи:
pm2 logs amg-bot
# или
journalctl -u amg-bot -n 50

# Проверьте .env:
cat .env

# Проверьте порт:
netstat -tulpn | grep 3001
```

### Заявки не приходят:

```bash
# Проверьте логи бота:
tail -f bot.log

# Проверьте API вручную:
curl http://localhost:3001/health

# Проверьте firewall:
ufw allow 3001/tcp
```

### "Unauthorized" ошибка:

Проверьте что `API_SECRET` в .env и telegram-bot.php одинаковые!

---

## ✅ Checklist развертывания

- [ ] VPS настроен, Node.js установлен
- [ ] Создан НОВЫЙ токен бота (старый отозван!)
- [ ] Файлы бота загружены на VPS
- [ ] .env настроен с правильными значениями
- [ ] npm install выполнен
- [ ] Бот запущен и отвечает на команды
- [ ] Chat ID получен через /chatid
- [ ] MANAGER_CHAT_IDS обновлен в .env
- [ ] PM2/systemd настроен для автозапуска
- [ ] telegram-bot.php обновлен на хостинге
- [ ] Тестовая заявка успешно доставлена
- [ ] Настроен мониторинг

---

**Готово!** Теперь ваш бот работает 24/7 и принимает заявки с сайта!

Если возникнут проблемы - проверьте логи: `pm2 logs amg-bot`
