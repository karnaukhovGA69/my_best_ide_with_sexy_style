# mcp-resource-quickaccess-remove

Статус: ЗАНЯТО / в работе. Владелец: агент mcp-workbench-inventory-remove. Ветка: `agent/mcp-resource-quickaccess-remove`. База: `670cc65fce4` (актуальный main после 0.0.8).

До реализации зарезервированы `src/vs/workbench/contrib/mcp/browser/mcpResourceQuickAccess.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpResourceQuickAccess.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

Удалить реализацию загрузки/просмотра ресурсов MCP, навигации, URI templates, открытия ресурсов и прикрепления к чату. Сохранить минимальные неактивные McpResourceQuickPick/McpResourceQuickAccess для существующих imports/DI/регистрации; серверный picker завершается без UI, quick access выдаёт пустой список без обращений к MCP. Общие commands/contribution/entrypoints, документы, voice, обычный поиск/редакторы/подсказки не менять. Только целевые проверки; общий build/release остаётся интегратору.
