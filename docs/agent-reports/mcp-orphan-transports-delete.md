# mcp-orphan-transports-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-orphan-transports-delete`. База: `62f2cc32a7c`. Claim: `43a3474670f`. Код: `df809ed15779ba9b3aa061fc5e5da85e9c39eaaa`.

Полностью удалены `src/vs/platform/mcp/node/mcpGatewaySession.ts`, `src/vs/platform/mcp/test/node/mcpGatewaySession.test.ts`, `src/vs/workbench/contrib/mcp/node/mcpStdioStateHandler.ts`, `src/vs/workbench/contrib/mcp/test/node/mcpStdioStateHandler.test.ts`. Это 389 строк production и 543 строки tests удалённых реализаций (932 суммарно). Совместимых оболочек нет: production consumers уже отсутствовали после прежних gateway/API cleanup.

Удалён gateway session JSON-RPC/SSE protocol negotiation, notification broadcasts и tool/resource routing; удалён специальный MCP процессный shutdown/kill escalation handler. Общие http/JSON-RPC/process utilities, обычные Terminal/Tasks, GitHub auth и связанные компоненты не изменены.

Проверки: перед удалением repository search нашёл только определения и собственные tests; isInitializeMessage также не имел consumers. После удаления поиск идентификаторов/путей по src/extensions/build/scripts/test не находит ссылок. git diff --cached --check прошёл. 7 существующих Node tests mcpGatewayService/mcpGatewayChannel прошли (0 pending) через временный esbuild/Mocha harness, включая запрет HTTP listen, отсутствие timer/logger/invoker side effects и фактический IPC refusal. Первая попытка harness упала из-за рекурсивного require.resolve в самом helper; исправлена до успешного прогона, repository code не затрагивалась. Lint/TypeScript для удалённых файлов не запускались; полный build/package не требовался и не выполнялся.

Интегратору: независимая ветка. Никаких новых подключений нет. Общие интеграционные checks/native smoke остаются на пакет. Полное удаление MCP/AI не заявляется.
