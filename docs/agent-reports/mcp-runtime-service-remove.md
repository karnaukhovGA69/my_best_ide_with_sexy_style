# mcp-runtime-service-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-runtime-service-remove`. База: `98aa2b043b1`. Claim: `eb2c0ce8c0d`. Код/тесты: `7ce9e5ee9d3e0e9a2530a31eeb26c15ad1e09bf0`.

Изменены `src/vs/workbench/contrib/mcp/common/mcpService.ts`, соответствующий `test/common/mcpService.test.ts` и этот отчёт. Удалены server collection orchestration, McpServer construction, discovery activation, autostart/settings/profile/storage dependencies, metadata caches, 500 ms update scheduler и runtime subscriptions. Production diff: 227 строк удалено, 27 добавлено. Общие registry/server/authentication implementations, Git/SSH и другие агентские области не изменены.

McpService сохраняет IMcpService/Disposable без constructor dependencies: servers — пустой замороженный список; autostart немедленно returns working:false с независимыми пустыми массивами; lazy collection state AllKnown/empty; activate/reset/cancel/update не выполняют действий. Enablement всегда DisabledProfile/false, canSetEnabled false; попытки записи/reset ничего не запускают и не пишут storage. McpCollisionEnablementModel оставлен неизменённым: его используют отдельные registry tests.

Проверки: 6 новых browser tests проходят (DI без инфраструктуры, no timers при fake clock, inert observers, cancellation token без чтения, independent result arrays, enablement/reset/dispose). 16 существующих Server Label Collision Enablement tests проходят. Новый DI-тест на baseline ожидаемо падает из-за mcpRegistry dependency. ESLint и узкий TypeScript (0 diagnostics после исправления сужения типа assert в тесте) прошли; git diff --check прошёл.

Предыдущие tests активного McpService, включая URL policy/server startup scenarios через его assembly, заменены tests неактивного сервиса: эти сценарии больше недоступны через McpService. Это не проверка оставшегося McpServer отдельно; его implementation и общие policy/auth services не изменены. Одноимённый McpService в extensions/copilot — другой модуль и не затронут.

Интегратору: сохранена registerSingleton(IMcpService, McpService) совместимость; пользовательские сохранённые настройки/секреты не удаляются. Ветка независима от остальных готовых MCP patches. Полные build/typecheck/package/native smoke остаются на пакет. Наличие оставшихся registry/server/commands/shared consumers не позволяет объявить полное удаление MCP/AI.
