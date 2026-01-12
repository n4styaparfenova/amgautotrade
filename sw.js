// Service Worker для кеширования изображений и ресурсов
// Версия кеша - обновляйте при изменениях
const CACHE_VERSION = 'v1.0.3';
const CACHE_NAME = `amgautotrade-cache-${CACHE_VERSION}`;

// Ресурсы для предварительного кеширования
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/catalog.html',
    '/services.html',
    '/contacts.html',
    '/blog/index.html',
    '/images/logo.webp',
    '/images/hero-bg.webp',
];

// Стратегии кеширования для разных типов ресурсов
const CACHE_STRATEGIES = {
    // Изображения с maxposter.ru - кешировать на 30 дней
    maxposter: {
        pattern: /img\.maxposter\.ru/,
        strategy: 'cache-first',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
    },
    // Локальные изображения - кешировать на 30 дней
    images: {
        pattern: /\.(jpg|jpeg|png|gif|webp|svg|ico)$/,
        strategy: 'cache-first',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 дней
    },
    // CSS и JS - кешировать на 7 дней
    static: {
        pattern: /\.(css|js)$/,
        strategy: 'stale-while-revalidate',
        maxAge: 7 * 24 * 60 * 60 * 1000
    },
    // Шрифты - кешировать на 365 дней
    fonts: {
        pattern: /\.(woff|woff2|ttf|eot)$/,
        strategy: 'cache-first',
        maxAge: 365 * 24 * 60 * 60 * 1000
    },
    // HTML страницы - network-first (всегда свежие)
    html: {
        pattern: /\.html$/,
        strategy: 'network-first',
        maxAge: 1 * 60 * 60 * 1000 // 1 час
    },
    // API запросы (cars.json) - network-first (всегда свежие данные)
    api: {
        pattern: /\.json$/,
        strategy: 'network-first',
        maxAge: 5 * 60 * 1000 // 5 минут (используется только при офлайн)
    }
};

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Установка Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Предварительное кеширование ресурсов');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('[SW] Service Worker установлен');
                return self.skipWaiting(); // Активировать немедленно
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Активация Service Worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Удаляем старые кеши
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Удаление старого кеша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service Worker активирован');
            return self.clients.claim(); // Захватить контроль над всеми клиентами
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Определяем стратегию кеширования
    let strategy = null;

    for (const [key, config] of Object.entries(CACHE_STRATEGIES)) {
        if (config.pattern.test(url.href)) {
            strategy = config;
            break;
        }
    }

    // Если нет подходящей стратегии - используем network-first
    if (!strategy) {
        strategy = { strategy: 'network-first', maxAge: 0 };
    }

    // Применяем выбранную стратегию
    if (strategy.strategy === 'cache-first') {
        event.respondWith(cacheFirst(request, strategy));
    } else if (strategy.strategy === 'network-first') {
        event.respondWith(networkFirst(request, strategy));
    } else if (strategy.strategy === 'stale-while-revalidate') {
        event.respondWith(staleWhileRevalidate(request, strategy));
    }
});

/**
 * Стратегия: Cache First
 * Сначала проверяет кеш, если нет - загружает из сети
 */
async function cacheFirst(request, strategy) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        // Проверяем срок годности кеша
        const cachedTime = await getCacheTime(request);
        const now = Date.now();

        if (now - cachedTime < strategy.maxAge) {
            console.log('[SW] Возврат из кеша:', request.url);
            return cached;
        }
    }

    // Загружаем из сети
    try {
        const response = await fetch(request);

        // Кешируем успешный ответ
        if (response.status === 200) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            await setCacheTime(request, Date.now());
            console.log('[SW] Закешировано из сети:', request.url);
        }

        return response;
    } catch (error) {
        console.log('[SW] Сетевая ошибка, возврат из кеша:', request.url);
        return cached || new Response('Offline', { status: 503 });
    }
}

/**
 * Стратегия: Network First
 * Сначала пытается загрузить из сети, если не получается - из кеша
 */
async function networkFirst(request, strategy) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);

        if (response.status === 200) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            await setCacheTime(request, Date.now());
        }

        return response;
    } catch (error) {
        console.log('[SW] Сеть недоступна, возврат из кеша:', request.url);
        const cached = await cache.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

/**
 * Стратегия: Stale While Revalidate
 * Возвращает кешированную версию, одновременно обновляя кеш в фоне
 */
async function staleWhileRevalidate(request, strategy) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    // Запускаем обновление в фоне
    const fetchPromise = fetch(request).then((response) => {
        if (response.status === 200) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            setCacheTime(request, Date.now());
        }
        return response;
    });

    // Возвращаем кешированную версию или ждем сетевую
    return cached || fetchPromise;
}

/**
 * Сохранение времени кеширования
 */
async function setCacheTime(request, time) {
    const cacheTimeStore = await caches.open(`${CACHE_NAME}-timestamps`);
    const response = new Response(JSON.stringify({ time }));
    return cacheTimeStore.put(request, response);
}

/**
 * Получение времени кеширования
 */
async function getCacheTime(request) {
    const cacheTimeStore = await caches.open(`${CACHE_NAME}-timestamps`);
    const cached = await cacheTimeStore.match(request);

    if (cached) {
        const data = await cached.json();
        return data.time;
    }

    return 0;
}

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data === 'clearCache') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('[SW] Кеш очищен');
            })
        );
    }
});

console.log('[SW] Service Worker загружен');
