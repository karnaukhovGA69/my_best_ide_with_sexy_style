# mcp-action-rendering-runtime-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-action-rendering-runtime-remove`. База main `411cccde06e` + готовая mcp-browse-prompt-commands-remove.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpCommands.ts (только MCPServerActionRendering и orphan imports), browser/media/mcpServerAction.css, новый test/browser/mcpActionRendering.test.ts и этот отчёт. Удалить startup observers, action view registration, spinner interval, hover DOM/Markdown/checkbox settings mutation; оставить пустой Disposable contribution для существующего registration. Другие commands, common entrypoint, GitHub/auth/Git/SSH и чужие области не менять. Следующий пакет после release-0.0.9.
