// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('✅ Service Worker зарегистрирован:', registration.scope);

                // Проверка обновлений каждые 24 часа
                setInterval(() => {
                    registration.update();
                }, 24 * 60 * 60 * 1000);

                // Обработка обновлений SW
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 Доступно обновление. Обновите страницу для применения.');

                            // Опционально: показать уведомление пользователю
                            if (confirm('Доступна новая версия сайта. Обновить сейчас?')) {
                                newWorker.postMessage({ action: 'skipWaiting' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('❌ Ошибка регистрации Service Worker:', error);
            });

        // Обновление страницы при активации нового SW
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker обновлен');
        });
    });

    // Функция для очистки кеша (для отладки)
    window.clearSWCache = () => {
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('clearCache');
            console.log('Кеш очищается...');
        }
    };
}
