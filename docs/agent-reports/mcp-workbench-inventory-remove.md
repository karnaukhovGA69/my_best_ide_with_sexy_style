# mcp-workbench-inventory-remove

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-workbench-inventory-remove`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `5a89f66f176`; копия сразу помещена в собственный отчёт общего checkout. Код и тесты: `b5b08491f55` (`Remove MCP workbench inventory and management implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpWorkbenchService.test.ts` и этот отчёт.

Из production-модуля удалены 1172 строки старого кода: eager startup inventory query, management/profile/gallery/config/allowed-server/enablement listeners, registry sync delayer и generation caches, URL handler registration и install-link обработка, gallery/local mapping и внутренний McpWorkbenchServer, install/uninstall, чтение/разрешение shared MCP config, open editor/search и связанные действия. Реализация удалена, не спрятана настройкой.

Сохранён IMcpWorkbenchService-compatible McpWorkbenchService без constructor dependencies. local/queryLocal/getEnabledLocalMcpServers возвращают новые пустые массивы; readiness сразу разрешается; onChange/onReset — Event.None. queryGallery возвращает исчерпанный pager с независимыми пустыми страницами; gallery lookup — undefined. canInstall возвращает Markdown-объяснение недоступности; install/uninstall/open/openSearch явно отклоняются локализованной ошибкой. Метод handleURL возвращает false, URL handler не регистрируется. Configuration resolution возвращает undefined; getMcpConfigPath сохраняет синхронный overload для local server и Promise-overload для URI.

MCPContextsInitialisation сохранён с прежним ID, но зависит только от IContextKeyService и выставляет gallery status Unavailable, installed servers false. Убраны queryLocal, gallery/status listeners и отложенная подписка. Остальные context keys не меняются.

Поиск по src/extensions подтвердил, что concrete classes импортируются production-кодом только из mcp.contribution.ts; другие потребители используют сохранённый IMcpWorkbenchService contract. Eager singleton и AfterRestored contributor registration остаются совместимыми. Общий contract, contribution-файл предыдущей discovery-ветки, management/scanner/gallery services, авторизация, extension management, файловые сервисы, main/build/dependencies и чужие области не менялись.

## Проверки

- 10/10 новых unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium с собственными установленными зависимостями. Page errors нет; включён disposable leak checker.
- Strict DI без infrastructure и завершённая readiness; пустые inventory без разделяемого изменяемого массива; неактивные events; исчерпанный gallery pager и отсутствие чтения poison options/manifest; canInstall explanation; точные отказы install/uninstall/open/openSearch.
- Проверены оба getMcpConfigPath overload, отсутствие чтения scope/settings, editable config lookup undefined и URL handling false. Context initializer создаётся только с MockContextKeyService, сбрасывает прежние значения и сохраняет посторонний ключ. Реальные файлы/профили/установка/сеть не использовались.
- Контроль чувствительности: два strict-DI tests с исходным production-модулем из `59f0fde52ec`, подставленным в память bundler, ожидаемо падают на gallery/workbench service dependencies. Остальные восемь тестов на старой реализации не запускались. Checkout не менялся; page errors нет.
- Прежние tests работающего workbench inventory/config/gallery implementation заменены регрессиями нового пустого фасада. Это не проверка всей общей management infrastructure или сторонних extensions.
- Целевой ESLint обоих TS-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts src/vs/workbench/contrib/mcp/test/browser/mcpWorkbenchService.test.ts`.
- Узкая TypeScript noEmit проверка двух файлов с транзитивными imports, options `src/tsconfig.json` и существующими Node/src/typings/Monaco/DebugProtocol declarations: 0 diagnostics без фильтрации. Это не полный client typecheck.
- `git diff --check` прошёл; временный harness удалён. Зависимости не обновлялись; production bundle/package и native smoke не запускались.

## Интегратору и ограничения

Перенести `5a89f66f176`, `b5b08491f55` и финальный коммит отчёта либо merge task-ветки после review. Ветка основана на main и независима от предыдущих MCP task-веток; новых подключений не нужно. Включить в накопленный пакет и проверить startup с пустым/существующим профилем, ordinary extension management, settings/editor и отсутствие MCP inventory/UI activity при общем native smoke.

Пользовательские MCP files, secrets и установленные серверы на диске не удаляются. Management/scanner services и прочие прямые MCP callers вне этого фасада остаются. Пустой inventory отражает недоступность MCP в интерфейсе форка, а не отсутствие пользовательских данных. Полное удаление MCP/AI не заявляется. В main ещё не объединено; самостоятельной сборки/релиза нет.
