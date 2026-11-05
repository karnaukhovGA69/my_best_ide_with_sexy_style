# mcp-elicitation-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-copilot-config-disable и mcp-devmode-disable. Ветка: `agent/mcp-elicitation-disable`. База: `59f0fde52ec`. Claim до реализации: `04e14782d54`; реализация и тесты: `6a44f8b86a3`. Main и бинарный релиз не менялись.

## Область и реализация

Только `src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.ts`, этот отчёт. Резервация создана в общем checkout до реализации. Другие области агентов, общие chat/notification/opener/quick-input services, auth, MCP contracts/contributions, main/build/dependencies не менялись.

Сохранены `McpElicitationService` и публичный метод `elicit` с прежним service contract. Запрос всегда отклоняется с `McpError(-32000)` и локализованным сообщением недоступности; параметры, server/context и cancellation token не читаются. Возврат не имитирует согласие или отказ пользователя и не создаёт URL wait promise.

Удалены notification actions, quick input forms и validation/schema conversion, chat question carousel и URL authorization parts, открытие URL через opener, completion/cancellation/server subscriptions и связанные stores. Constructor DI dependencies отсутствуют. Удалено 709 строк старой реализации; общий UI и общие обработчики протокола остаются.

## Совместимость consumers

Поиск выполнен по `src` и `extensions`: единственный runtime import класса — прежняя singleton registration в `mcp.contribution.ts`; других exports/helpers/subclasses вне удалённой реализации нет. Потребители service interface — request handler callback в `McpServer` и URL-elicitation-required retry path в MCP tool call. Сигнатура сохранена, shared wiring не нужно.

Выбран именно `McpError`: `McpServerRequestHandler` переводит его в JSON-RPC error с сохранением кода, вместо generic internal-error wrapping. URL retry path получает rejected promise до обращения к result/wait/dispose, поэтому не продолжает tool retry после успешного UI-подтверждения. Это подтверждено чтением caller; отдельный end-to-end tool retry тест не запускался.

Advertised MCP capabilities, request handler task augmentation/TTL, MCP server telemetry call sites, общие chat UI classes и остальные MCP paths не изменены. Их наличие не означает, что этот сервис снова может показать elicitation UI. Не заявляется удаление всего AI/MCP или всех сетевых/аналитических путей.

## Проверки

- 6/6 новых browser tests прошли в Chromium через временный esbuild/Mocha harness реальных модулей: 0 failures, 0 page errors, штатная проверка disposable leaks. Покрыты strict DI, poison server/context/request/token objects, form/legacy form/URL, контекст чата и его отсутствие, cancelled/active tokens, конкурентные обращения, нулевые notification/quick-input/chat/opener calls и timers.
- Один из шести тестов использует настоящий `McpServerRequestHandler` с тестовым message transport. Три входящих `elicitation/create` получают JSON-RPC error -32000, правильный ID/текст и отсутствие result; следующий ping получает успешный ответ. Это проверка сериализации отказа, а не только direct method test. Task-augmented requests отдельно не проверялись.
- 3 существующих request-handler теста (`should handle server requests`, `should handle roots list requests`, `should handle error responses`) прошли без page errors.
- Контроль чувствительности 3 тестов (DI, form, legacy form): подстановка исходного сервиса из `59f0fde52ec` в память bundler дала 3 ожидаемых падения, 0 page errors. Старый сервис требует UI dependencies и читает server/context вместо продуктового отказа. URL и request-handler tests на baseline не запускались. Checkout не менялся; сеть, реальные MCP endpoints и browser URL opening не использовались.
- Ошибки проверяются явным rejection handler с assert.ok/strictEqual/match: browser assert.rejects shim не проверяет predicate/RegExp, поэтому не используется для проверки кода/текста отказа.
- Узкий TypeScript noEmit двух изменённых файлов с ambient declarations и транзитивными зависимостями: 1329 файлов графа, 0 diagnostics без фильтрации. Options из `src/tsconfig.json`, Node types подключены явно; это не полный client typecheck.
- Целевой ESLint обоих TS-файлов прошёл после замены двух запрещённых in-операторов в тесте на hasKey/Object.hasOwn; тест повторно проверен. `git diff --check` прошёл. Собственные зависимости переиспользованы; launcher использовал pnpm 11.25.0 при закреплённом 12.16.0, package/lockfiles не менялись.

## Интегратору

Перенести `agent/mcp-elicitation-disable` целиком либо implementation `6a44f8b86a3` с отчётом. Ветка от main, не зависит от прошлых MCP-патчей. Необходимых изменений общих entrypoints нет.

В общем checkout незакоммиченная копия этого отчёта — наша резервация, обновлённая результатом. Если она мешает cherry-pick, сверить и заменить только этот файл версией task-ветки, сохраняя чужие отчёты. На общем output выполнить `vs/workbench/contrib/mcp/test/browser/mcpElicitationService.test.js` и релевантные `mcpServerRequestHandler.test.js` штатным runner.

Полный typecheck, production bundle/package, native Electron/web/remote smoke и релиз не запускались по правилу пакетных сборок; их выполняет интегратор на общем дереве. Экономия RAM/CPU и отсутствие всей MCP/AI активности продукта не измерялись.
