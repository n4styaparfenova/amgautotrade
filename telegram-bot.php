<?php
/**
 * Telegram Bot Integration для AMG Auto Trade (Node.js версия)
 *
 * Отправляет заявки с сайта на Node.js бот, работающий на VPS
 *
 * АРХИТЕКТУРА:
 * Сайт → telegram-bot.php (этот файл) → Node.js бот на VPS → Telegram API → Менеджеры
 *
 * ИНСТРУКЦИЯ ПО НАСТРОЙКЕ:
 *
 * 1. Убедитесь, что Node.js бот запущен на VPS:
 *    - Подключитесь к VPS: ssh ubuntu@195.209.210.45
 *    - Проверьте статус: pm2 list
 *    - Должен быть процесс "amg-bot" со статусом "online"
 *
 * 2. Настройки уже заданы:
 *    - NODE_BOT_URL: http://195.209.210.45:3001/api/lead
 *    - API_SECRET: должен совпадать с .env на VPS
 *
 * 3. Для тестирования откройте в браузере:
 *    https://ваш-домен.ru/telegram-bot.php?test=1
 *
 * 4. Проверьте логи на VPS:
 *    pm2 logs amg-bot
 */

// ============================================
// НАСТРОЙКИ БОТА
// ============================================

// URL Node.js бота на VPS
define('NODE_BOT_URL', 'http://195.209.210.45:3001/api/lead');

// Секретный ключ для API (должен совпадать с API_SECRET в .env на VPS)
define('API_SECRET', 'amgautotrade_secret_2025_change_this');

// Логирование (для отладки)
define('ENABLE_LOGGING', true);
define('LOG_FILE', __DIR__ . '/telegram-bot.log');

// ============================================
// CORS HEADERS
// ============================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Обработка preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================
// ТЕСТОВЫЙ РЕЖИМ
// ============================================
if (isset($_GET['test'])) {
    testTelegramBot();
    exit;
}

// ============================================
// ОСНОВНАЯ ЛОГИКА
// ============================================

// Проверяем, что запрос POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Метод не разрешен. Используйте POST.');
}

// Получаем данные
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Логируем входящий запрос
if (ENABLE_LOGGING) {
    logMessage('Incoming request: ' . $input);
}

// Валидация данных
if (empty($data['name']) || empty($data['phone'])) {
    sendResponse(false, 'Не заполнены обязательные поля');
}

// Очистка данных
$name = htmlspecialchars(trim($data['name']), ENT_QUOTES, 'UTF-8');
$phone = htmlspecialchars(trim($data['phone']), ENT_QUOTES, 'UTF-8');
$message = isset($data['message']) ? htmlspecialchars(trim($data['message']), ENT_QUOTES, 'UTF-8') : '';
$source = isset($data['source']) ? htmlspecialchars(trim($data['source']), ENT_QUOTES, 'UTF-8') : 'Главная страница';
$car = isset($data['car']) ? htmlspecialchars(trim($data['car']), ENT_QUOTES, 'UTF-8') : '';

// Формируем данные для отправки на Node.js бот
$leadData = [
    'name' => $name,
    'phone' => $phone,
    'message' => $message,
    'source' => $source,
    'car' => $car,
    'secret' => API_SECRET
];

// Отправляем на Node.js бот
$result = sendToNodeBot($leadData);

if ($result['success']) {
    // Дополнительно можно сохранить в БД, отправить email и т.д.
    // saveToDatabase($name, $phone, $message);
    // sendEmail($name, $phone, $message);

    sendResponse(true, 'Заявка успешно отправлена');
} else {
    logMessage('Telegram API Error: ' . $result['error']);
    sendResponse(false, 'Ошибка отправки: ' . $result['error']);
}

// ============================================
// ФУНКЦИИ
// ============================================

/**
 * Отправка данных на Node.js бот
 */
function sendToNodeBot($leadData) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, NODE_BOT_URL);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($leadData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if (ENABLE_LOGGING) {
        logMessage("Node.js Bot Response (HTTP {$httpCode}): {$response}");
    }

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (isset($result['success']) && $result['success']) {
            return ['success' => true];
        } else {
            return ['success' => false, 'error' => $result['error'] ?? 'Unknown error'];
        }
    } else {
        return ['success' => false, 'error' => $error ?: "HTTP {$httpCode}"];
    }
}

/**
 * Отправка JSON ответа
 */
function sendResponse($success, $message) {
    echo json_encode([
        'success' => $success,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Логирование
 */
function logMessage($message) {
    if (!ENABLE_LOGGING) return;

    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$message}\n";
    file_put_contents(LOG_FILE, $logEntry, FILE_APPEND);
}

/**
 * Тестовая функция
 */
function testTelegramBot() {
    echo "<html><head><meta charset='utf-8'><title>Node.js Bot Test</title></head><body>";
    echo "<h1>🤖 Тест Node.js Telegram Bot</h1>";

    // Проверка настроек
    echo "<h2>1. Проверка настроек:</h2>";
    echo "<p>✓ Node.js Bot URL: <code>" . NODE_BOT_URL . "</code></p>";
    echo "<p>✓ API Secret: " . (API_SECRET !== 'amgautotrade_secret_2025_change_this' ? '<span style="color: green;">Настроен</span>' : '<span style="color: orange;">Используется стандартный (рекомендуется изменить)</span>') . "</p>";

    // Проверка подключения к Node.js боту
    echo "<h2>2. Проверка подключения к Node.js боту:</h2>";
    $healthUrl = str_replace('/api/lead', '/health', NODE_BOT_URL);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $healthUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $result = json_decode($response, true);
        if (isset($result['status']) && $result['status'] === 'ok') {
            echo "<p style='color: green;'>✓ Подключение к Node.js боту успешно!</p>";
            echo "<p>Статус бота:<br>";
            echo "- Режим: {$result['mode']}<br>";
            echo "- Uptime: " . round($result['uptime']) . " секунд<br>";
            echo "- Время: {$result['timestamp']}</p>";
        } else {
            echo "<p style='color: red;'>✗ Бот вернул неожиданный ответ</p>";
        }
    } else {
        echo "<p style='color: red;'>✗ Не удалось подключиться к Node.js боту (HTTP {$httpCode})</p>";
        echo "<p>Проверьте, что бот запущен на VPS и порт 3001 доступен.</p>";
    }

    // Отправка тестовой заявки
    echo "<h2>3. Отправка тестовой заявки:</h2>";
    $testLead = [
        'name' => 'Тестовый клиент',
        'phone' => '+7 (999) 123-45-67',
        'message' => 'Это тестовая заявка для проверки интеграции',
        'source' => 'Тест PHP скрипта',
        'car' => 'BMW X5 2023',
        'secret' => API_SECRET
    ];
    $result = sendToNodeBot($testLead);

    if ($result['success']) {
        echo "<p style='color: green;'>✓ Тестовая заявка отправлена успешно!</p>";
        echo "<p>Проверьте Telegram - сообщение должно прийти менеджерам.</p>";
    } else {
        echo "<p style='color: red;'>✗ Ошибка отправки: " . $result['error'] . "</p>";
    }

    echo "<hr>";
    echo "<h2>📋 Инструкция:</h2>";
    echo "<ol>";
    echo "<li>Убедитесь, что Node.js бот запущен на VPS (pm2 list)</li>";
    echo "<li>Проверьте, что порт 3001 доступен</li>";
    echo "<li>Убедитесь, что API_SECRET в этом файле совпадает с .env на VPS</li>";
    echo "<li>Для смены секретного ключа отредактируйте константу API_SECRET</li>";
    echo "</ol>";

    echo "</body></html>";
}

?>