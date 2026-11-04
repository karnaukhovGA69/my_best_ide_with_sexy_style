# mcp-context-ui-remove

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-context-ui-remove`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpAddContextContribution.ts`, `src/vs/workbench/contrib/mcp/common/mcpContextKeys.ts`, новые `src/vs/workbench/contrib/mcp/test/browser/mcpAddContextContribution.test.ts` и `src/vs/workbench/contrib/mcp/test/common/mcpContextKeys.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: удалить MCP attachment picker contribution и его наблюдение за серверами; удалить динамическую синхронизацию MCP UI context keys с серверами, оставив совместимые exports и пустое состояние (0/false) для существующих потребителей. Не менять общий chat picker, context key service, resource quick access, contribution-файлы, main, entrypoints, build, зависимости и области других агентов. Целевые тесты; общая интеграция и сборка остаются интегратору.
