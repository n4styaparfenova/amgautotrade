/**
 * Динамическая подмена номера телефона для атрибуции звонков по каналам.
 *
 * Номера (Mango Office):
 *   -50 (по умолчанию, органика/сайт): +7 (985) 674-26-50
 *   -52 (Яндекс.Директ):               +7 (985) 674-26-52
 *   -54 (соцсети):                      +7 (985) 674-26-54
 *
 * Определяет источник по yclid, UTM-меткам или referrer.
 * Сохраняет в localStorage на 30 дней чтобы номер не менялся при повторных визитах.
 * Наблюдает за DOM чтобы подменять номер в динамически добавленном контенте.
 */
(function() {
    // === НАСТРОЙКИ ===
    var ORIGINAL = '+79856742650';
    var ORIGINAL_DISPLAY_SUFFIX = '674-26-50';

    var CHANNELS = {
        direct: { phone: '+79856742652', display: '+7 (985) 674-26-52', suffix: '674-26-52' },
        social: { phone: '+79856742654', display: '+7 (985) 674-26-54', suffix: '674-26-54' }
    };

    var STORAGE_KEY = 'amg_phone_channel';
    var TTL_DAYS = 30;

    var phoneRegex = /\+?7?\s*\(?\s*985\s*\)?\s*674[\s-]*26[\s-]*50/g;

    // === ОПРЕДЕЛЕНИЕ КАНАЛА ===

    function detectChannel() {
        var params;
        try { params = new URLSearchParams(window.location.search); } catch(e) { return null; }

        // Яндекс.Директ: yclid или UTM
        if (params.get('yclid')) return 'direct';
        if (params.get('utm_source') === 'yandex' && params.get('utm_medium') === 'cpc') return 'direct';
        if (params.get('utm_medium') === 'cpc') return 'direct';

        // Соцсети: UTM
        var src = (params.get('utm_source') || '').toLowerCase();
        var med = (params.get('utm_medium') || '').toLowerCase();
        if (med === 'social') return 'social';
        if (src === 'telegram' || src === 'instagram' || src === 'vk' || src === 'facebook') return 'social';

        // Соцсети: referrer
        try {
            var ref = document.referrer.toLowerCase();
            if (ref.indexOf('t.me/') !== -1 || ref.indexOf('instagram.com') !== -1 ||
                ref.indexOf('vk.com') !== -1 || ref.indexOf('facebook.com') !== -1) return 'social';
        } catch(e) {}

        return null;
    }

    // === ХРАНЕНИЕ ===

    function getStored() {
        try {
            var stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                var data = JSON.parse(stored);
                if (data.expires > Date.now()) return data.channel;
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch(e) {}
        return null;
    }

    function setStored(channel) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                channel: channel,
                expires: Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000
            }));
        } catch(e) {}
    }

    // === ПОДМЕНА ===

    function replaceInNode(root, ch) {
        // Заменяем href в ссылках tel:
        var links = root.querySelectorAll('a[href*="tel:"]');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            if (href.indexOf('9856742650') !== -1 || href.indexOf('79856742650') !== -1) {
                links[i].href = 'tel:' + ch.phone;
                phoneRegex.lastIndex = 0;
                if (phoneRegex.test(links[i].textContent)) {
                    phoneRegex.lastIndex = 0;
                    links[i].textContent = links[i].textContent.replace(phoneRegex, ch.display);
                }
                phoneRegex.lastIndex = 0;
            }
        }

        // Заменяем номер в обычном тексте
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.parentElement && node.parentElement.tagName === 'A') continue;
            phoneRegex.lastIndex = 0;
            if (phoneRegex.test(node.textContent)) {
                phoneRegex.lastIndex = 0;
                node.textContent = node.textContent.replace(phoneRegex, ch.display);
            }
        }
    }

    function replacePhone() {
        // Определяем канал: из URL или из хранилища
        var channel = detectChannel();
        if (channel) {
            setStored(channel);
        } else {
            channel = getStored();
        }

        if (!channel || !CHANNELS[channel]) return;
        var ch = CHANNELS[channel];

        replaceInNode(document.body, ch);

        // MutationObserver для динамического контента (каталог)
        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    for (var j = 0; j < mutations[i].addedNodes.length; j++) {
                        var node = mutations[i].addedNodes[j];
                        if (node.nodeType === 1) replaceInNode(node, ch);
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Событие в Метрику для отладки
        if (typeof ym === 'function') {
            ym(105327533, 'params', { phone_channel: channel });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replacePhone);
    } else {
        replacePhone();
    }
})();
