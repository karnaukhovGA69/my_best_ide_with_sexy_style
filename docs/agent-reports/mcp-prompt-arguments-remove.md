# mcp-prompt-arguments-remove

Статус: ЗАНЯТО / в работе. Владелец: агент mcp-resource-quickaccess-remove. Ветка: `agent/mcp-prompt-arguments-remove`. База: `81efa000a9f` (актуальный main).

До правок зарезервированы `src/vs/workbench/contrib/mcp/browser/mcpPromptArgumentPick.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpPromptArgumentPick.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

Удалить MCP-specific argument picker: UI, server completions, чтение файлов/выделения, поиск и запуск команд для вставки stdout. Оставить Disposable-класс с прежним prompt-аргументом и createArgs, возвращающим undefined (отмена) без сервисов и побочных эффектов. Общий chatInputCompletions.ts не менять: его отдельный вызов server.start перед createArgs остаётся за рамками этой задачи и должен быть отдельно очищен. Обычные Terminal/Tasks, поиск, редакторы, IntelliSense, общие entrypoints, voice/documents не менять. Только целевые проверки; build/release за интегратором.
