/**
 * Подмена номера телефона для посетителей из Яндекс Директ.
 * Определяет источник по yclid, UTM-меткам или referrer.
 * Сохраняет в localStorage на 30 дней чтобы номер не менялся при повторных визитах.
 * Наблюдает за DOM чтобы подменять номер в динамически добавленном контенте.
 */
(function() {
    // === НАСТРОЙКИ ===
    var ORIGINAL = '+74994907030';
    var TRACKING = '+74994907903';
    var TRACKING_DISPLAY = '+7 (499) 490-79-03';
    var STORAGE_KEY = 'amg_direct_visitor';
    var TTL_DAYS = 30;

    var phoneRegex = /\+?7?\s*\(?\s*499\s*\)?\s*490[\s-]*70[\s-]*30/g;

    function isYandexDirect() {
        var params = new URLSearchParams(window.location.search);
        // yclid — автоматическая метка Директа
        if (params.get('yclid')) return true;
        // UTM-метки для ручной разметки
        if (params.get('utm_source') === 'yandex' && params.get('utm_medium') === 'cpc') return true;
        // Referrer от Яндекса с рекламным параметром
        try {
            var ref = document.referrer;
            if (ref && ref.indexOf('yandex') !== -1 && window.location.search.indexOf('yclid') !== -1) return true;
        } catch(e) {}
        return false;
    }

    function shouldSubstitute() {
        // Проверяем localStorage с TTL
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var data = JSON.parse(stored);
                if (data.expires > Date.now()) return true;
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch(e) {}

        // Также проверяем sessionStorage (обратная совместимость)
        if (sessionStorage.getItem('amg_phone_source') === 'direct') {
            markAsDirect();
            return true;
        }

        if (isYandexDirect()) {
            markAsDirect();
            return true;
        }
        return false;
    }

    function markAsDirect() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                expires: Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000
            }));
        } catch(e) {}
    }

    function replaceInNode(root) {
        // Заменяем href в ссылках tel:
        var links = root.querySelectorAll('a[href*="tel:"]');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            if (href.indexOf('4994907030') !== -1 || href.indexOf('74994907030') !== -1) {
                links[i].href = 'tel:' + TRACKING;
                if (phoneRegex.test(links[i].textContent)) {
                    phoneRegex.lastIndex = 0;
                    links[i].textContent = links[i].textContent.replace(phoneRegex, TRACKING_DISPLAY);
                }
                phoneRegex.lastIndex = 0;
            }
        }

        // Заменяем номер в обычном тексте
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.parentElement && node.parentElement.tagName === 'A') continue;
            if (/490[\s-]*70[\s-]*30/.test(node.textContent)) {
                phoneRegex.lastIndex = 0;
                node.textContent = node.textContent.replace(phoneRegex, TRACKING_DISPLAY);
            }
        }
    }

    function replacePhone() {
        if (!shouldSubstitute()) return;
        replaceInNode(document.body);

        // MutationObserver для динамического контента
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                        var node = mutations[i].addedNodes[j];
                        if (node.nodeType === 1) replaceInNode(node);
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replacePhone);
    } else {
        replacePhone();
    }
})();
