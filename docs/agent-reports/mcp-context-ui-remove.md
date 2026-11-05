# mcp-context-ui-remove

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-context-ui-remove`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `c3d0445751a`; копия сразу помещена в собственный отчёт общего checkout. Реализация и тесты: `549ba9e6ad0` (`Remove MCP attachment contribution and dynamic UI context`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/browser/mcpAddContextContribution.ts`, `src/vs/workbench/contrib/mcp/common/mcpContextKeys.ts`, новые `src/vs/workbench/contrib/mcp/test/browser/mcpAddContextContribution.test.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpContextKeys.test.ts` и этот отчёт.

Удалены реализация MCP Resources attachment contribution, регистрация picker, создание McpResourcePickHelper, преобразование resources в attachment picks и autorun/derived наблюдение за серверами. Оставлен неактивный compatibility class McpAddContextContribution без service dependencies, чтобы существующая регистрация Eventually не ломалась.

Из McpContextKeysController удалены IMcpService dependency, bindContextKey/autorun, чтение серверов/tools/cache/discovery/connection errors. Контроллер теперь однократно выставляет serverCount/toolsCount в 0, hasUnknownTools/hasServersWithErrors в false через обычный IContextKeyService. Сохранены экспортируемые RawContextKeys, имена ключей, class и ID: их используют preconditions в mcpCommands.ts. Существующая BlockRestore-регистрация остаётся совместимой. Это удаление динамической MCP-реализации с минимальным совместимым пустым состоянием, не изменение пользовательской настройки видимости.

Общие chat picker/context key services, resource quick access/helper, contribution-файлы прежней discovery-ветки, main, entrypoints, API, build и зависимости не менялись. Области других агентов, включая MCP elicitation и keyword activation, не затронуты.

## Проверки

- 6/6 новых unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium с существующими зависимостями своего рабочего каталога. Page errors нет; включён disposable leak checker.
- Attachment contribution: strict DI без services; три варианта server capabilities — неизвестные, Resources и только Tools. При изменении inventory/capabilities и после dispose нет чтений наблюдаемого списка серверов и MCP picker. Обычный тестовый attachment остаётся в настоящем ChatContextPickService.
- Context keys: strict DI только с context service; замена прежних ненулевых/true значений пустым состоянием, сохранение постороннего ключа, повторный dispose. Изменения server inventory, tools, error/running, cache и discovery state не читаются и не меняют пустое состояние. Используются реальные observableValue/derived и штатный MockContextKeyService; настоящий DOM context key service в этом suite не запускался.
- Контроль чувствительности: оба исходных production-модуля из `59f0fde52ec` подставлены в память bundler без изменения checkout; все 6 тестов ожидаемо падают. Обнаружены прежние service dependencies, MCP Resources picker и непустые/динамические MCP context keys. Page errors нет.
- Целевой ESLint всех четырёх TS-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint <четыре перечисленных TypeScript-файла>`.
- Узкая TypeScript noEmit проверка через compiler API с options `src/tsconfig.json`, четырьмя файлами и транзитивными imports: 0 diagnostics без фильтрации. Включены существующие Node/src/typings, Monaco и DebugProtocol declarations. Это не полный client typecheck.
- `git diff --check` прошёл. Временный harness удалён. Общие зависимости не переустанавливались; production bundle/package и native smoke не запускались.

## Интегратору и ограничения

Ветка независима от предыдущих task-веток, основана на main. Новых подключений не требуется. Перенести `c3d0445751a`, `549ba9e6ad0` и финальный коммит отчёта либо merge ветки после review. Включить в общий пакет; native smoke обычного интерфейса и предикатов оставшихся команд выполнить перед релизом.

Удалён только MCP attachment contributor и динамический MCP UI context controller. Другие MCP commands/resource quick access и прямые вызовы helper остаются вне этой задачи. Пустые context keys не являются запретом выполнения команд через API и не доказывают полное удаление MCP/AI. Общие chat attachments не удалены. В main ещё не объединено; самостоятельной сборки или релиза нет.
