# mcp-platform-gateway-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-api-disable/documents-ui. Ветка: `agent/mcp-platform-gateway-disable`. База: `59f0fde52ec`. Claim до реализации: `ab3fdd0dbe2`. Код и тесты: `cfd305b2fca`. Main и бинарный релиз не менялись.

## Область и результат

Изменены только `src/vs/platform/mcp/node/mcpGatewayService.ts`, `src/vs/platform/mcp/node/mcpGatewayChannel.ts`, новые `src/vs/platform/mcp/test/node/mcpGatewayService.test.ts` и `mcpGatewayChannel.test.ts`, этот отчёт. Резервация создана в общем checkout до реализации. Задача A05 отделена от `mcp-workbench-gateway-disable`, которому принадлежат workbench service adapters и broker contributions.

`McpGatewayService` теперь сохраняет DI service contract, но не создаёт logger, HTTP server/listener, UUID routes, MCP sessions, storage/maps, event subscriptions или startup timeout. `createGateway` отклоняет запрос локализованной ошибкой недоступности MCP до чтения client context и tool invoker. Cleanup старого gateway/client безопасен и идемпотентен. Удалены HTTP request routing, body parsing и route/session lifecycle из этого файла; общие JSON-RPC/HTTP primitives и отдельный `mcpGatewaySession.ts` не изменены.

`McpGatewayChannel` сохраняет export, event name и callable IPC endpoint. `createGateway` сразу отклоняется, не запрашивая broker channel, `listServers`, chatSessionResource, logger или backend. Это существенно: прежняя реализация сначала обращалась к broker и только затем вызывала gateway service, поэтому одного отключения HTTP сервиса было недостаточно. `disposeGateway` завершается без backend, event возвращает `Event.None`, неизвестные операции по-прежнему дают явную ошибку. Подписка на удаление IPC connections и карты клиентов/ресурсов убраны.

Совместимость consumers проверена по `src` и `extensions`: main process создаёт `McpGatewayChannel(server, service, logger)` напрямую, remote server использует `instantiationService.createInstance(McpGatewayChannel, socketServer)`. Сохранён constructor с необязательными legacy service/logger аргументами; аргументы не читаются и не сохраняются, service decorators удалены. Remote создание больше не требует их DI-instantiation. Оба пути имеют регрессионные тесты. `McpGatewayService` по-прежнему совместим с `SyncDescriptor` в main/remote.

## Проверки

- 7/7 Node unit tests успешно через временный esbuild/Mocha harness реальных модулей; включена штатная проверка disposable leaks. Проверены strict DI без сервисов; main constructor с poison mocks; отсутствие вызова `http.Server.prototype.listen`, logger creation, timers и обращения к invoker; разные client contexts; cleanup/dispose; неизвестные команды и event.
- Один из тестов использует реальные `ChannelClient`/`ChannelServer` и in-memory message protocol. Зарегистрированный endpoint выдаёт отказ `createGateway`, успешный cleanup и ошибку неизвестной команды без broker registration. Это IPC roundtrip, а не только прямой вызов метода; сокет не открывался.
- Контроль чувствительности двух DI-тестов: временная подстановка исходных runtime-модулей из `59f0fde52ec` в памяти bundler дала 2 ожидаемых падения на зависимостях logger/gateway. Checkout не менялся. Другие 5 тестов на старой реализации не запускались.
- Узкий TypeScript noEmit четырёх изменённых файлов с существующими ambient declarations и транзитивными зависимостями: 674 файла графа, 0 diagnostics без фильтрации. Использованы options `src/tsconfig.json`, Node types подключены явно. Это не полный client/server typecheck.
- Целевой ESLint четырёх TS-файлов прошёл после замены статического HTTP import в тесте на dynamic import по правилу проекта. Затронутый файл перепроверен. `git diff --check` успешно.
- Проверки выполнены в Node 26.8.2 с собственными зависимостями рабочего каталога. Launcher использовал pnpm 11.25.0 при закреплённом 12.16.0; зависимости и lockfiles не изменялись. В поставку новый runtime или test harness не добавлялись.

## Интегратору

Перенести `agent/mcp-platform-gateway-disable` целиком либо кодовый коммит `cfd305b2fca` вместе с отчётом. Ветка основана на main и независима от прежнего API-патча и workbench gateway-патча. Общие entrypoints, contracts, main/shared/server wiring не менялись и для применения не требуют новых registrations. Незакоммиченная копия этого отчёта в общем checkout — наша резервация; при блокировке cherry-pick сверить и заменить только этот файл версией task-ветки, сохраняя чужие отчёты.

Существующие named channel registrations намеренно сохранены для явного отказа старым callers. Их окончательное удаление и очистка оставшихся gateway session/broker implementation выполняются интегратором после удаления всех потребителей. Main всё ещё явно получает logger service при передаче legacy constructor argument; канал его не использует. Другие MCP runtime/management, AI, HTTP и IPC каналы этим патчем не отключены.

На общем скомпилированном output выполнить `scripts/test.sh --run vs/platform/mcp/test/node/mcpGatewayService.test.js` и соответствующий `vs/platform/mcp/test/node/mcpGatewayChannel.test.js`. Включить в пакет общие type/DI checks, desktop startup и remote handshake/terminal/filesystem smoke. Полная сборка, packaged/native Electron, реальное SSH-подключение и релиз не запускались согласно правилу пакетных сборок; Node unit tests их не заменяют. Отсутствие всей MCP/AI сетевой активности продукта и экономия ресурсов не заявляются.
