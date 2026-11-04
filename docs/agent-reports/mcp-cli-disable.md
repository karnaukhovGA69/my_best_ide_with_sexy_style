# mcp-cli-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее mcp-sampling-log-disable. Ветка: `agent/mcp-cli-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/platform/mcp/common/mcpManagementCli.ts`, новый `src/vs/platform/mcp/test/common/mcpManagementCli.test.ts`, этот отчёт. Не назначать второго владельца.

Задача A05: отключить CLI endpoint добавления MCP definitions до разбора аргументов, обращения к MCP management/install и изменения конфигурации. Сохранить совместимость вызывающих CLI entrypoints, выдавать явный отказ без содержимого аргументов в ошибке/логах. Общие CLI entrypoints/help/options, MCP management service/contracts, обычную установку VSIX, main/build/dependencies и области других агентов не менять. Интеграция и полная сборка — у интегратора.
