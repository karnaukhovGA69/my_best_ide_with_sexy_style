# mcp-task-manager-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-task-manager-remove`. База: `62f2cc32a7c`.

Зарезервированы `src/vs/workbench/contrib/mcp/common/mcpTaskManager.ts`, новый `src/vs/workbench/contrib/mcp/test/common/mcpTaskManager.test.ts` и этот отчёт. Удалить серверное выполнение/хранение результатов/TTL и client task adoption/reconnection registry. Сохранить совместимый класс/interface, пустой список/events и явный McpError при выполнении/чтении/принятии задач; принятую задачу dispose перед отказом, чтобы не оставить её таймеры. Это протокольные MCP tasks, не обычные Terminal/Tasks. GitHub auth, общие Tasks, request handler implementation, другие активные области и entrypoints не менять. Целевые проверки без сборки релиза.
