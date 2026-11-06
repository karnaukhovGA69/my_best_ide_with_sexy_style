# mcp-action-rendering-runtime-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-action-rendering-runtime-remove`. База main `411cccde06e` + mcp-browse-prompt-commands-remove. Claim `be8b6b3b62c`. Код/тесты: `08c1949b59747df3e50a67568acd1c09d272549b`. Следующий пакет после release-0.0.9.

В browser/mcpCommands.ts удалён весь MCPServerActionRendering runtime: state/config observers, action-view registration, spinner interval, hover DOM/Markdown, checkbox listener/settings changes. Сохранён пустой Disposable contribution с прежним export для существующей startup registration. Orphan browser/media/mcpServerAction.css полностью удалён; src/extensions/build не содержит его imports/selector references. Другие command implementations/metadata не менялись.

Добавлены test/browser/mcpActionRendering.test.ts: 2 теста проходят — DI без MCP/action/command/config services, trap services и fake clock подтверждают отсутствие обращений/таймеров при startup/disposal. 7 command tests проходят. ESLint обоих TS прошёл; узкий TypeScript — 0 diagnostics; git diff --check прошёл. Общий Markdown/hover/action-view infrastructure сохранён; 297 строк удалено из production files, добавлен regression suite.

Интегрировать после mcp-browse-prompt-commands-remove (`227c4981eb7`), уже входящего в ветку; оба changes касаются одного модуля. Общий entrypoint не изменён. GitHub/auth/Git/SSH, пользовательские настройки и чужие области не менялись. Полные typecheck/build/package/native smoke — на следующем пакете.
