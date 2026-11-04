# mcp-elicitation-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-copilot-config-disable и mcp-devmode-disable. Ветка: `agent/mcp-elicitation-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить MCP elicitation forms/URL requests, их notification/quick-input/chat UI, открытие URL и подписки, сохранив service/export contract и явный отказ. Проверить callers и ожидания результата до правок. Общие chat/notification/opener/quick-input services, MCP contracts/contributions, auth, другие области агентов, main/build/dependencies не менять. Полная сборка и релиз — у интегратора.
