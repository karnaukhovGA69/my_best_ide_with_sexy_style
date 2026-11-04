# mcp-sampling-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-api-disable и mcp-platform-gateway-disable. Ветка: `agent/mcp-sampling-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpSamplingService.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpSamplingService.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить запросы MCP sampling к языковым моделям, выбор моделей и связанные prompts/permissions/storage/listeners, сохранив service/export contracts для существующих consumers. Проверить потребителей до удаления exports. Не менять общий language model API, MCP contracts/contributions, resource filesystem другого агента, gateway/API/discovery/gallery/migration, voice, Terminal/Tasks, documents/PDF, main, зависимости и build. Полная сборка и релиз — у интегратора.
