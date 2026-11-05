# mcp-orphan-server-delete

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-server-delete`. База: main `b73001809cd` + готовые runtime-service/connection branches; необходимая зависимость удаления: mcp-runtime-service-remove (`7ce9e5ee9d3`).

Зарезервированы в `src/vs/workbench/contrib/mcp/`: `common/mcpServer.ts`, `common/mcpIcons.ts`, `common/mcpConfigFileUtils.ts`, `test/common/mcpPrefixGenerator.test.ts`, `test/common/mcpIcons.test.ts`, `common/mcpDevMode.ts`, `test/common/mcpDevMode.test.ts` и этот отчёт. Полностью удалить orphan server/cache/prefix implementation, icons helper и configuration mapping; убрать только orphan McpDevModeServerAttache и его тесты. IMcpDevModeDebugging/McpDevModeDebugging остаются для registry/contribution. Проверка всех exports/imports/consumers перед удалением; GitHub/auth/Git/SSH, общие MCP types/registry, чужие области не редактируются.
