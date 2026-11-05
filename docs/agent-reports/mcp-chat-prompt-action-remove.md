# mcp-chat-prompt-action-remove

Статус: ЗАНЯТО / в работе. Владелец: агент mcp-prompt-arguments-remove. Ветка: `agent/mcp-chat-prompt-action-remove`. База: `5f88b8b3d41`.

Зарезервированы `src/vs/workbench/contrib/chat/browser/widget/input/editor/chatInputCompletions.ts`, `src/vs/workbench/contrib/chat/test/browser/widget/input/editor/chatInputCompletions.test.ts` и этот отчёт. Другим агентам не менять эти файлы до завершения.

Удалить только MCP completion provider и StartParameterizedPromptAction с запуском сервера, resolve и attachment processing, убрать MCP DI dependency. Сохранить остальные completion providers и проверить существующие tests. GitHub authentication и связанный код, общие editor language services, Terminal/Tasks, документы, voice, shared entrypoints не менять. Предыдущие независимые задачи готовы отдельно. Целевые проверки; build/release за интегратором.
