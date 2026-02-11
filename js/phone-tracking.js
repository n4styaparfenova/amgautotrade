/**
 * Подмена номера телефона для посетителей из Яндекс Директ.
 * Определяет источник по yclid (Yandex Click ID) или UTM-меткам.
 * Сохраняет в sessionStorage чтобы номер не менялся при переходах по сайту.
 */
(function() {
    // === НАСТРОЙКИ ===
    var ORIGINAL = '+74994907030';
    var ORIGINAL_DISPLAY = '+7 (499) 490-70-30';
    var TRACKING = '+74994907903';
    var TRACKING_DISPLAY = '+7 (499) 490-79-03';
    var STORAGE_KEY = 'amg_phone_source';

    function isYandexDirect() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('yclid')) return true;
        if (params.get('utm_source') === 'yandex' && params.get('utm_medium') === 'cpc') return true;
        return false;
    }

    function shouldSubstitute() {
        if (sessionStorage.getItem(STORAGE_KEY) === 'direct') return true;
        if (isYandexDirect()) {
            sessionStorage.setItem(STORAGE_KEY, 'direct');
            return true;
        }
        return false;
    }

    function replacePhone() {
        if (!shouldSubstitute()) return;

        // Заменяем href в ссылках tel:
        var links = document.querySelectorAll('a[href="tel:' + ORIGINAL + '"]');
        for (var i = 0; i < links.length; i++) {
            links[i].href = 'tel:' + TRACKING;
            // Заменяем текст если он содержит номер
            if (links[i].textContent.indexOf('490-70-30') !== -1) {
                links[i].textContent = links[i].textContent.replace(
                    /\+?7?\s*\(?\s*499\s*\)?\s*490[\s-]*70[\s-]*30/g,
                    TRACKING_DISPLAY
                );
            }
        }

        // Заменяем номер в обычном тексте (не в ссылках)
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            var node = walker.currentNode;
            if (node.parentElement && node.parentElement.tagName === 'A') continue;
            if (/490[\s-]*70[\s-]*30/.test(node.textContent)) {
                node.textContent = node.textContent.replace(
                    /\+?7?\s*\(?\s*499\s*\)?\s*490[\s-]*70[\s-]*30/g,
                    TRACKING_DISPLAY
                );
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replacePhone);
    } else {
        replacePhone();
    }
})();
