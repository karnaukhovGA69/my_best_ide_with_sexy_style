# mcp-request-handler-runtime-delete

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-request-handler-runtime-delete`. База: main `b73001809cd` + runtime-service/server-connection/orphan-server branches. Обязательные зависимости: mcp-server-connection-remove и mcp-orphan-server-delete.

Зарезервированы в src/vs/workbench/contrib/mcp: common/mcpServerRequestHandler.ts, test/common/mcpServerRequestHandler.test.ts, test/common/mcpTaskManager.test.ts, test/browser/mcpElicitationService.test.ts и этот отчёт. Удалить не создаваемый production code MCP RPC handler и McpTask, сохранить только type-only McpServerRequestHandler interface для общих contracts. Удалить tests удалённых runtime scenarios, оставить проверки task manager/elicitation unavailable. Общий JsonRpcProtocol, GitHub/auth/Git/SSH и чужие области исключены. Проверить type consumers и соседние suites; Copilot applyPatch corpus fixture со старым snapshot handler не является runtime import и не меняется.
