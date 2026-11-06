# mcp-request-handler-runtime-delete

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-request-handler-runtime-delete`. База: main `b73001809cd` + runtime-service/server-connection/orphan-server branches. Claim `ed335fd0864`. Код: `d5ca4686f76b5220d3571223b51868e5e52c3eb8`.

Из common/mcpServerRequestHandler.ts удалена вся runtime implementation: JSON-RPC dispatch/handshake, protocol subscriptions/logging, roots/tools/resources/prompts/tasks calls, McpTask, unused options/root exports и logging maps. Остался только 44-строчный TypeScript interface McpServerRequestHandler (imports type), совместимый с remaining connection/types/task-manager consumers; нет constructor/create/runtime object. Общая библиотека JsonRpcProtocol не изменена.

Удалён test/common/mcpServerRequestHandler.test.ts и только obsolete active-handler integration case в test/browser/mcpElicitationService.test.ts, плюс test удалённого McpTask в test/common/mcpTaskManager.test.ts. Остальные unavailable tests сохранены. Поиск src/extensions/build по TS/JS не находит вызовов create/new или удалённых exports. Исторический текст в Copilot applyPatch corpus fixture — отдельные тестовые данные, не runtime consumer; он сохранён.

Проверки: 5 elicitation + 4 task manager + 5 connection browser tests прошли; ESLint трёх изменённых TS-файлов прошёл; узкий TypeScript с mcpCommands consumer root — 0 diagnostics; git diff --check прошёл. Итог diff: 1154 строк удалено, 40 добавлено. Новые тесты не добавлялись: удалён неиспользуемый runtime, оставшийся интерфейс проверен типами.

Интегрировать после mcp-server-connection-remove (`c53c9153f4a`) и mcp-orphan-server-delete (`6914fdf6323`), включая их runtime-service dependency. Ветка содержит все эти изменения. Полные typecheck/build/package/native smoke — на пакете. GitHub/auth/Git/SSH не менялись; остальные MCP registry/UI/shared contracts остаются.
