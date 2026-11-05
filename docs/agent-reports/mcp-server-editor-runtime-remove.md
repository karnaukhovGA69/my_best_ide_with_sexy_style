# mcp-server-editor-runtime-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-server-editor-runtime-remove`. База: main `411cccde06e`. Следующий пакет после release-0.0.9.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpServerEditor.ts, browser/media/mcpServerEditor.css, новый test/browser/mcpServerEditor.test.ts (пути внутри contrib/mcp) и этот отчёт. Удалить редактор MCP-каталога: загрузку README/manifest/webviews, install/actions/rendering/navigation. Сохранить зарегистрированный EditorPane ID с простой доступной unavailable надписью для старых/явных inputs; base editor lifecycle/focus/layout без чтения MCP server metadata. Common entrypoint, общий Markdown/webview/editor, конфигурационную форму chat, GitHub/auth/Git/SSH не менять.
