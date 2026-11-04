# mcp-api-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее documents-ui и ai-terminal-cleanup. Ветка: `agent/mcp-api-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/api/browser/mainThreadMcp.ts`, `src/vs/workbench/api/common/extHostMcp.ts`, `src/vs/workbench/api/node/extHostMcpNode.ts`, их MCP tests в `src/vs/workbench/api/test/{browser,common,node}/` и этот отчёт. Не назначать второго владельца этих файлов.

Задача из карты MCP-аудита: совместимый неактивный extension API bridge. Сохранить API symbols и disposable registration без вызовов providers; убрать MCP transports/auth/startup listeners и RPC timers в своей области; явный запуск/gateway отклонять. Проверить внешних потребителей до удаления exports. Не менять общие entrypoints/protocol/API declarations, GitHub authentication, SSH, Terminal/Tasks, documents/PDF, gallery и discovery области других агентов. Полная сборка и релиз остаются интегратору.
