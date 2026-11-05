# mcp-server-controls-runtime-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-server-controls-runtime-remove`. База main `411cccde06e` + mcp-install-actions-runtime-remove.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpServerActions.ts (UninstallAction, четыре Enable/DisableMcpServer*Action, Start/Stop/RestartServerAction, ConfigureModelAccessAction, ShowSamplingRequestsAction, BrowseResourcesAction, McpServerStatusAction и orphan imports/helpers), новый test/browser/mcpServerControls.test.ts и этот отчёт. Удалить runtime mutations/subscriptions/command dispatch; сохранить class/action identities как disabled/hidden с unavailable run без DI. AuthServerAction, ShowServerOutputAction, ShowServerConfigurationAction, ShowServerJsonConfigurationAction и общие menu/dropdown/frameworks исключены. GitHub/auth/Git/SSH не менять. Следующий пакет после release-0.0.9.
