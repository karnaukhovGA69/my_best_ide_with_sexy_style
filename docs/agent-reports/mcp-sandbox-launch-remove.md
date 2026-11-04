# mcp-sandbox-launch-remove

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-sandbox-launch-remove`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: удалить MCP-specific sandbox launch transformation, remote environment lookup, временные config files, suggestions и запись разрешений. Сохранить service contract с явным отказом запуска (никогда не возвращать исходный несandboxed launch), false/undefined для отключённых capability/suggestion операций. Удалить неиспользуемые MCP-only path helpers после проверки потребителей. Не менять общую terminal sandbox инфраструктуру, Terminal/Tasks, MCP registry/server, contribution-файлы, main/build/dependencies и чужие области. Полная интеграция остаётся интегратору.
