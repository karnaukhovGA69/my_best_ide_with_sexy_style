# mcp-lifecycle-commands-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-lifecycle-commands-remove`. База main `411cccde06e` + mcp-browse-prompt-commands-remove/mcp-action-rendering-runtime-remove.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpCommands.ts (ListMcpServerCommand private/runtime methods, RestartServer/StartServer/StopServer/ResetMcpTrustCommand/ResetMcpCachedTools/McpSkipCurrentAutostartCommand run и orphan list-only helpers/imports), новый test/browser/mcpLifecycleCommands.test.ts и этот отчёт. Сохранить Action2 metadata, заменить runtime явным unavailable отказом без чтения services/options. Удалить local/agent-host picker orchestration и прямые lifecycle calls в этих командах. AgentHostServerOptions/ServerOptions, auth/storage/manual configuration и общие services исключены; shared helpers, которые ещё использует options UI, оставить. Следующий пакет после release-0.0.9.
