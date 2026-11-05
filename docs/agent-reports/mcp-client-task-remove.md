# mcp-client-task-remove

Статус: ЗАНЯТО / в работе. Владелец: MCP cleanup. Ветка: `agent/mcp-client-task-remove`. База: `62f2cc32a7c`.

Зарезервированы `src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpServerRequestHandler.test.ts` и этот отчёт. Удалить только McpTask client polling/TTL/result fetch/notifications execution, сохранив методы и ленивый явно rejected result. Удалённые (ранее skipped) tests polling заменить активными unavailable tests; остальные RPC tests оставить. Общую RPC реализацию, GitHub auth и его окружение, обычные Tasks, другие области не менять. McpTaskManager предыдущей ветки независим; build/release за интегратором.
