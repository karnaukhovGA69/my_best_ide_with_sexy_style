# agent-plugin-url-handler-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-url-handler-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить регистрацию и runtime PluginUrlHandler для chat-plugin install/add-marketplace links. Область: chat/browser/pluginUrlHandler.ts; chat/test/browser/plugins/pluginUrlHandler.test.ts; этот отчёт. Сохранить ID и совместимый IURLHandler.handleURL с false; не регистрироваться в общем URL service. Общие URL/auth/extensions/Git/VSIX, stored plugin data и shared entrypoints не менять.

Удалены URL registration, plugin source parsing, marketplace lookup/add/install и создание AI session из ссылки. Совместимый handleURL возвращает false без чтения URI; ID сохранён. Код: 7e70f307110.

Проверки: 1 browser test — strict DI, install/add-marketplace/unrelated links и unreadable URI без обращения к services; ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check. Общие URL/auth/extensions/Git API и файлы пользователя не менялись. Full build/package/native smoke не запускались.
