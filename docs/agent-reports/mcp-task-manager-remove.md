# mcp-task-manager-remove

Статус: ГОТОВО / ожидает интеграции; известная baseline browser error указана ниже. Владелец: MCP cleanup. Ветка: `agent/mcp-task-manager-remove`. База: `62f2cc32a7c`. Claim: `37497ec2583`. Код/тесты: `a44c287725a9e4a6166ada1a67938bb7354f5c2b`.

Изменены `src/vs/workbench/contrib/mcp/common/mcpTaskManager.ts`, новый `src/vs/workbench/contrib/mcp/test/common/mcpTaskManager.test.ts` и этот отчёт. Удалены server task execution/storage/results/TTL, client registry/reconnection и emitters. Production diff: 232 удалённых строки, 26 добавленных. Обычный Terminal/Tasks, GitHub auth и его окружение не затронуты.

Сохранены Disposable-класс и IMcpTaskInternal. listTasks возвращает независимый пустой список; getClientTask — undefined; onDidUpdateTask — Event.None; setHandler/abandon безопасно игнорируются. createTask никогда не вызывает executor и синхронно бросает локализованный McpError(-32000); getTask/cancelTask тоже отказывают, getTaskResult отклоняется асинхронно. adoptClientTask вызывает dispose у переданного объекта перед отказом, поскольку caller уже создал McpTask с timers/listeners; поля id/handler не читаются. Старый handler.callTool получает отказ adoption до task.setHandler и не переходит к ожиданию task.result.

Проверки: 5 новых browser tests прошли, включая реальный McpTask с TTL и проверкой disposable leaks. ESLint, узкий TypeScript (0 diagnostics) и git diff --check прошли. 11 активных тестов mcpServerRequestHandler прошли; 14 McpTask tests уже помечены suite.skip в исходниках, они не выдаются за пройденные. Baseline контроль ошибки статуса/результата/отмены ожидаемо провалился (прежний -32602 вместо нового -32000).

Ограничение проверки: mcpServerConnection — 18/18 assertions pass, но одна необработанная browser error Canceled; harness завершился exit 1. Повтор с production-файлом mcpTaskManager из базы 62f2cc32a7c воспроизводит ровно тот же результат (18 pass, одна Canceled). Этот прогон не считается чистым успешным. Чужой connection lifecycle не изменялся; интегратору учитывать baseline cancellation issue в общем пакете. Browser harness — временный esbuild/Mocha/Chromium.

Интегратору: ветка независима, public methods сохранены; основные consumers McpServerRequestHandler/McpServerConnection/McpServer. Сам McpTask и общие RPC transport implementation ещё существуют; полный запрет исходящих MCP tool calls не заявляется. Общие build/typecheck/package/native smoke не запускались и остаются для пакета.
