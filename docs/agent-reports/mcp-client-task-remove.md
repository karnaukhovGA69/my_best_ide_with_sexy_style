# mcp-client-task-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-client-task-remove`. База: `62f2cc32a7c`. Claim: `c4c37719349`. Код/тесты: `4a433b51762799b142c5f582e6677ce6cacf191d`.

Изменены только `src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts`, соответствующий `test/common/mcpServerRequestHandler.test.ts` и этот отчёт. Из McpTask удалены TTL/poll timers, cancellation subscriptions, observable status/handler state, tasks/get/result RPC, deferred completion и status callbacks. Общие JSON-RPC методы handler, ordinary Tasks/Terminal, GitHub auth и связанные компоненты не менялись.

Сохранены export McpTask, конструктор, id, result, setHandler/onDidUpdateState/dispose. Result лениво создаёт стабильный rejected Promise с локализованным McpError(-32000); rejection не создаётся в constructor, поэтому не появляется необработанная ошибка при создании без чтения result. Metadata/token/handler/status callbacks не используются для фоновой работы. id сохраняет прежний идентификатор.

Проверки: 18 browser tests прошли без page errors: 11 прежних RPC, 6 новых client-task tests, 1 новый реальный transport/handler тест task-augmented tools/call response. Последний проверяет немедленный отказ без tasks polling и ожидания completion. Прежние 14 skipped polling tests заменены активными unavailable tests. Fake-clock тест подтверждает 0 timers и отсутствие чтения data/token; повторное dispose безопасно. На baseline production-файле этот новый тест ожидаемо падает на чтении task data. ESLint, узкий TypeScript (0 diagnostics), git diff --check прошли.

Интегратору: ветка независима от agent/mcp-task-manager-remove; старый task manager корректно освобождает task через finally при отклонении result, новый manager отказывает ещё при adoption. Новый transport-тест принимает McpError(-32000) обоих вариантов. Общая RPC реализация остаётся; полное удаление MCP/AI не заявляется. Полный build/package/native smoke не запускались, остаются для интеграционного пакета.
