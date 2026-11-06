# mcp-plugin-discovery-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-plugin-discovery-delete`. База main `b73001809cd`. Claim `46230c3b772`. Код: `af29a6ff21aa0c1c05ff8364c824712dbfc35308`.

Полностью удалены common/discovery/pluginMcpDiscovery.ts, common/discovery/mcpDiscovery.ts и test/common/pluginMcpDiscovery.test.ts в contrib/mcp: plugin observers, collection conversion/registration и orphan discovery registry. Единственный production consumer plugin-модуля, chat/browser/aiCustomization/mcpListWidget.ts, импортировал только MCP_PLUGIN_COLLECTION_ID_PREFIX: импорт перенаправлен в уже подключённый mcpTypes.ts, где константа определена. Поведение widget не менялось.

Из test/browser/mcpDiscovery.test.ts и test/electron-browser/mcpDiscoveryRegistration.test.ts удалены только assertions к удалённому registry; сохранены DI contract/gateway registration tests. Поиск src/extensions/build (TS/JS) не находит импортов/классов удалённых discovery-модулей. После ранее интегрированного удаления native/workspace discovery каталог common/discovery пуст.

Проверки: 1 common contribution + 1 native contribution browser tests прошли; ESLint трёх изменённых файлов прошёл; узкий TypeScript с mcpListWidget root — 0 diagnostics; git diff --check прошёл. 240 строк удалено, 1 добавлена в 6 файлах. Дополнительных зависимостей сверх main нет; готовые runtime/server branches не требуются. Полные build/typecheck/package — на пакете. GitHub/auth/Git/SSH и пользовательские данные не менялись.
