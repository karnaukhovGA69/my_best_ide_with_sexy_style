# mcp-app-transport-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-app-transport-remove`. База: `5f88b8b3d41`.

Зарезервированы `src/vs/workbench/contrib/mcp/browser/mcpToolCallUI.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpToolCallUI.test.ts` и этот отчёт. Удалить local/AHP transport implementations, tool/resource/sampling calls и notification forwarding. Сохранить минимальный McpToolCallUI/IMcpAppResourceContent для consumer: операции явно недоступны, event пустой, hostContext постоянный без environment/theme наблюдения. GitHub auth, shared agent host infrastructure, chatMcpAppModel, voice/documents и общие entrypoints не менять. Целевые проверки, без build/release.
