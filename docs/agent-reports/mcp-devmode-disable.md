# mcp-devmode-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-sampling-disable и mcp-platform-gateway-disable. Ветка: `agent/mcp-devmode-disable`. База: `59f0fde52ec`. Claim: `cab5d3b589f`; реализация и тесты: `ab3f91ae457`. Main и бинарный релиз не менялись.

## Область и результат

Только `src/vs/workbench/contrib/mcp/common/mcpDevMode.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpDevModeDebuggingNode.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpDevMode.test.ts`, новый `src/vs/workbench/contrib/mcp/test/electron-browser/mcpDevModeDebuggingNode.test.ts` и этот отчёт. Область была зарезервирована до реализации в общем checkout; точное имя native-файла уточнено сразу после claim. Common contracts/contributions, registry/server implementation, общий debug service/adapters, file service, Terminal/Tasks, прочие области агентов, main/build/dependencies не менялись.

`McpDevModeServerAttache` сохранён с прежними двумя caller arguments и Disposable lifecycle, но больше не читает server definitions/lastModeDebugged, не подписывается на registry/workspace/server/file state, не запускает и не перезапускает MCP server. Удалены glob filtering, file watcher, observable autoruns и Throttler. Даже старые watch/debug settings и изменение definitions не активируют этот путь.

`IMcpDevModeDebugging`, decorator и class export сохранены. `transform` явно отклоняет запрос локализованной ошибкой недоступности MCP debugging до чтения definition/launch, без преобразования команды или параметров запуска. Удалены Node inspect injection, debugpy command discovery и debugger attach. Desktop export `McpDevModeDebuggingNode` переиспользует эту реализацию без INativeHostService, поиска свободного порта, проверки isPortFree и 50-ms polling до 30 секунд.

## Совместимость

Поиск consumers выполнен по `src` и `extensions`. `McpServer` создаёт attachment через DI с `(server, fwdRef)` — этот путь сохраняется без infrastructure services. Common/desktop contributions регистрируют прежние exports под прежним decorator; новые подключения не нужны. Единственный оставшийся runtime caller transform — debug-ветка `McpRegistry.resolveConnection`: её существующий catch сообщает об ошибке и возвращает undefined до создания McpServerConnection. Запрос debug не превращается в незаметный обычный запуск. Protected port methods использовались только удалённым native override; внешних subclasses/consumers не найдено.

Обычная отладка пользовательских проектов не изменена, но её native end-to-end smoke в этом задании не выполнялся. MCP UI/schema, ручной обычный запуск MCP и остальные MCP runtime paths остаются за другими задачами; это не заявление о полном удалении MCP.

## Проверки

- 6/6 целевых browser tests через временный esbuild/Mocha harness реальных source modules в Chromium: 0 failures, 0 page errors, штатная проверка disposable leaks. Покрыты DI без сервисов, poison server/fwdRef/definition objects, legacy watch/debug settings, reactive changes/file events, отсутствие start/stop/watch/listeners/timers, HTTP/Node/Python transform rejection, неизменность launch и отсутствие native/debug/command calls.
- Контроль чувствительности двух поведенческих тестов с исходными common/native runtime modules из `59f0fde52ec`, подставленными в память bundler: 2 ожидаемых падения, 0 page errors. Старый attachment сделал 3 start, 2 stop, 2 watch и подписался на file events; старый native adapter обратился к port service. Checkout не менялся, реальные debugger/native services не вызывались.
- При проверке обнаружено, что browser assert shim не проверяет RegExp-параметр assert.rejects. Новые transform-тесты используют явный promise rejection handler с assert.match, чтобы ошибка poison mock не считалась правильным продуктовым отказом. После этого обе baseline-регрессии падают ожидаемо, а новая реализация проходит.
- Существующие suites `mcpService.test.ts` и `mcpRegistry.test.ts`: 106/106 tests passed, но harness завершился с ненулевым кодом из-за 4 page errors `Canceled` при JsonRpcProtocol.cancelAllRequests. Весь широкий прогон не обозначается чистым. Те же 4 teardown cancellations ранее воспроизведены на исходном mcpService suite базы `59f0fde52ec` при проверке mcp-sampling-disable (41/41 tests passed); соответствующие исходники и зависимости не менялись. В шести целевых тестах этих ошибок нет. Общие файлы ради устранения фонового поведения не менялись.
- Узкий TypeScript noEmit четырёх изменённых файлов с project ambient declarations и транзитивными зависимостями: 1361 файл графа, 0 diagnostics без фильтрации; options из `src/tsconfig.json`, Node types явно подключены. Это не полный client typecheck.
- Целевой ESLint всех четырёх TS-файлов прошёл, изменённые тесты перепроверены после усиления error assertions. `git diff --check` прошёл. Собственные зависимости рабочего каталога переиспользованы. Launcher использовал pnpm 11.25.0 при закреплённом 12.16.0; lockfile и версии не менялись.

## Интегратору

Перенести `agent/mcp-devmode-disable` целиком либо implementation `ab3f91ae457` вместе с отчётом. Ветка независима от прежних API/gateway/sampling-патчей и других агентов. Common и native implementation нужно переносить вместе: native adapter ранее наследовал удалённые protected methods.

В общем checkout незакоммиченная копия этого отчёта — наша резервация, обновлённая результатом. Если она мешает cherry-pick, сверить и заменить только этот файл версией task-ветки, сохраняя чужие отчёты. На общем output выполнить `vs/workbench/contrib/mcp/test/common/mcpDevMode.test.js` и `vs/workbench/contrib/mcp/test/electron-browser/mcpDevModeDebuggingNode.test.js` штатным runner и учесть результат широких MCP suites выше.

Полный typecheck, production bundle/package, native Electron/debugger, реальные Node/Python debug sessions, SSH/remote smoke и релиз не запускались по правилу пакетных сборок. Их выполняет интегратор на общем дереве; Chromium-тест desktop export не является native smoke. Отсутствие всей MCP/AI сетевой активности и экономия ресурсов не заявляются.
