# mcp-browse-prompt-commands-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-browse-prompt-commands-remove`. База main `411cccde06e`. Следующий пакет после release-0.0.9.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpCommands.ts (только run implementations шести команд Browse/BrowsePage/ShowInstalled/BrowseResources/ConfigureSamplingModels/StartPromptingServer и orphan imports), test/browser/mcpCommands.test.ts, browser/openPanelChatAndGetWidget.ts и этот отчёт. Удалить routing к marketplace/views/resource picker, model selection и chat prompt insertion; сохранить Action2 identities/metadata с явным unavailable error без services/server access. Остальные команды, включая OAuth/storage/manual configuration, не менять. Удалить ставший orphan openPanelChat helper. GitHub/auth/Git/SSH и чужие области исключены.
