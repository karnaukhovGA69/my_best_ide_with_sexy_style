# mcp-tool-contribution-disable

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-tool-contribution-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts`, новый `src/vs/workbench/contrib/mcp/test/common/mcpLanguageModelToolContribution.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: удалить startup-синхронизацию MCP tools с language-model tools service, autorun/listeners, создание tool sets и MCP-specific tool invocation adapter. Сохранить неактивный compatibility export/ID для существующей регистрации. Не менять общий tools service, MCP sampling другого агента, contribution-файлы, main, общие entrypoints, extension API, зависимости и build. Полная интеграция и сборка остаются интегратору.
