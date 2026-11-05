# mcp-orphan-transports-delete

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-transports-delete`. База: `62f2cc32a7c`.

Зарезервированы для удаления `src/vs/platform/mcp/node/mcpGatewaySession.ts`, `src/vs/platform/mcp/test/node/mcpGatewaySession.test.ts`, `src/vs/workbench/contrib/mcp/node/mcpStdioStateHandler.ts`, `src/vs/workbench/contrib/mcp/test/node/mcpStdioStateHandler.test.ts`, а также этот отчёт. Production consumers отсутствуют после прежнего удаления gateway/API implementations: остались лишь собственные тесты. Удалить модули полностью без facade; проверить отсутствие imports/build references и действующие gateway service/channel tests. Общие HTTP/process utilities, Terminal/Tasks, GitHub auth, MCP registry/auth и чужие области не менять. Полной сборки не запускать.
