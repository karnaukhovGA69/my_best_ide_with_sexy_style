# mcp-sampling-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-api-disable и mcp-platform-gateway-disable. Ветка: `agent/mcp-sampling-disable`. База: `59f0fde52ec`. Claim до реализации: `14632125cdf`. Код и тесты: `1e944164f77`. Main и бинарный релиз не менялись.

## Область

`src/vs/workbench/contrib/mcp/common/mcpSamplingService.ts`, новый `src/vs/workbench/contrib/mcp/test/common/mcpSamplingService.test.ts`, только sampling-регрессия в существующем `src/vs/workbench/contrib/mcp/test/common/mcpService.test.ts`, этот отчёт. Дополнение области существующим тестом отражено в общем файле-резервации до реализации. MCP resource filesystem принадлежит другому агенту и не менялся. Общие contracts, contributions, language model API, MCP gateway/API/discovery/gallery/migration, voice, Terminal/Tasks, Git/auth, documents/PDF, зависимости и build не менялись.

## Результат

`McpSamplingService` сохранён как совместимый DI service с прежними публичными методами. Удалены преобразование sampling prompts/media, выбор модели, очередь model selection, sendChatRequest, обработка model stream, sampling logs, session permissions, чтение/изменение settings и prompting через dialogs/notifications/commands. Constructor dependencies отсутствуют; сервис не создаёт McpSamplingLog.

`sample` всегда возвращает rejected promise с `McpError`, кодом -32000 и локализованным сообщением о недоступности sampling. Он не читает request/token, поэтому legacy permissions, auto-approve, during/outside chat, concurrent requests и cancellation не могут открыть этот путь. `updateConfig` также явно отклоняется без вызова mutation callback и записи settings. `getConfig` возвращает новый объект с обоими разрешениями false и пустым allowedModels; изменение полученного объекта не влияет на сервис. `hasLogs` возвращает false, `getLogText` — пустую строку, без чтения server metadata.

Проверены consumers в `src` и `extensions`: registration в `mcp.contribution.ts`, request handler в `mcpServer.ts`, configuration/log UI consumers в `mcpCommands.ts`, `mcpServerActions.ts`, `mcpToolCallUI.ts`, существующие tests. Единственный export модуля — сохранённый McpSamplingService. Код -32000 совместим с существующим MCP error path; сообщение не приписывает пользователю отказ, которого он не давал.

Существующая regression `app request metadata and legacy permissions cannot enable MCP sampling` продолжает проверять propagation of isDuringToolCall через реальный McpServer/test transport для шести запросов. Теперь все шесть отклоняются независимо от legacy flags и metadata; дополнительно проверяется нулевой sendChatRequest. Остальные сценарии этого файла не менялись.

## Проверки

- 7 целевых browser tests (6 новых + 1 обновлённая regression) прошли в Chromium через временный esbuild/Mocha harness реальных модулей: 0 failures, 0 page errors. Включена штатная проверка disposable leaks. Покрыты strict DI, poison request/server/token objects, конкурентные запросы, cancellation, отсутствие timers, конфигурация/logs, mutation callback и повторный dispose.
- Полные два затронутых suites: 47/47 assertions tests passed. При teardown Chromium сообщил 4 page errors `Canceled` из JsonRpcProtocol.cancelAllRequests. Поэтому весь прогон не обозначается полностью чистым. Для сравнения подставлены в память исходные McpSamplingService и mcpService.test из `59f0fde52ec`: 41/41 tests passed с теми же 4 `Canceled`. Это существующее поведение широкого suite/harness; в целевом наборе ошибок нет. Другие файлы ради устранения этой фоновой ошибки не менялись.
- Контроль чувствительности обновлённой regression: с исходным sampling service и новым тестом получено ожидаемое падение — старый сервис разрешил 3 из 6 запросов, новый отклоняет все. Модель и транспорт тестовые, внешних model endpoints нет. Checkout при сравнении не менялся.
- Узкий TypeScript noEmit для трёх TS-файлов, ambient declarations и транзитивных зависимостей: 1376 файлов графа, 0 diagnostics без фильтрации; настройки из `src/tsconfig.json`, Node types подключены явно. Это не полный client typecheck.
- Целевой ESLint трёх изменённых TS-файлов и `git diff --check` прошли. Собственные зависимости рабочего каталога переиспользованы, новых packages нет. Launcher использовал pnpm 11.25.0 при закреплённом 12.16.0; lockfile и версии не менялись.

## Интегратору

Перенести `agent/mcp-sampling-disable` либо implementation `1e944164f77` вместе с отчётом. Новое wiring не требуется: прежняя singleton registration совместима. Ветка независима от прошлых MCP API/gateway веток и resource filesystem. При дальнейшей работе с `mcpService.test.ts` сохранить обновлённую sampling-regression; другие тесты файла не затронуты.

В общем checkout незакоммиченная копия этого отчёта — наша резервация, обновлённая результатом. Если она мешает cherry-pick, сверить и заменить только собственный файл версией task-ветки, сохраняя чужие отчёты. На общем output выполнить suites `vs/workbench/contrib/mcp/test/common/mcpSamplingService.test.js` и `vs/workbench/contrib/mcp/test/common/mcpService.test.js` штатным test runner; отдельно учитывать уже воспроизведённые teardown cancellations.

Оставшиеся MCP commands/UI, sampling log class, schema, server-advertised capabilities и общие language-model services не удалены. Ручной Configure Sampling Models UI может ещё перечислять модели до отказа updateConfig; эту область требуется отключать отдельно. Патч запрещает sampling через этот service, а не доказывает отсутствие всего AI, всех model calls или сетевой активности продукта. Полный typecheck, production package, native/web/remote smoke и релиз не запускались по правилу пакетной сборки и остаются интегратору.
