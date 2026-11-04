# mcp-devmode-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-sampling-disable и mcp-platform-gateway-disable. Ветка: `agent/mcp-devmode-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpDevMode.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpDevMode.ts`, соответствующие dev-mode tests в `src/vs/workbench/contrib/mcp/test/{common,electron-browser}/`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить автоматический запуск/перезапуск MCP dev servers, file watchers, MCP debug attach и поиск/ожидание debug ports, сохранив совместимые exports/DI contracts. Проверить callers до удаления методов. Обычные debug services/adapters, file service, Terminal/Tasks, MCP common contracts/contributions, другие области агентов, main/build/dependencies не менять. Полная сборка и релиз — у интегратора.
