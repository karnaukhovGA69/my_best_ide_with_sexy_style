# agent-plugin-url-handler-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-plugin-url-handler-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить регистрацию и runtime PluginUrlHandler для chat-plugin install/add-marketplace links. Область: chat/browser/pluginUrlHandler.ts; chat/test/browser/plugins/pluginUrlHandler.test.ts; этот отчёт. Сохранить ID и совместимый IURLHandler.handleURL с false; не регистрироваться в общем URL service. Общие URL/auth/extensions/Git/VSIX, stored plugin data и shared entrypoints не менять.
