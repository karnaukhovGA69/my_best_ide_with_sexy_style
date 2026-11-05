# mcp-workbench-gateway-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit/gallery/discovery/migration. Ветка: `agent/mcp-workbench-gateway-disable`. База: `59f0fde52ec`.

Резервирование до реализации: `428069c6e2a`; отметка сразу опубликована в собственном отчёте общего checkout. Реализация и тесты: `74de60bebe0` (`Disable workbench MCP gateways and startup brokers`).

## Изменённая область

- `src/vs/workbench/contrib/mcp/browser/mcpGatewayService.ts`
- `src/vs/workbench/contrib/mcp/electron-browser/mcpGatewayService.ts`
- `src/vs/workbench/contrib/mcp/browser/mcpGatewayToolBrokerContribution.ts`
- `src/vs/workbench/contrib/mcp/electron-browser/mcpGatewayToolBrokerContribution.ts`
- `src/vs/workbench/contrib/mcp/test/browser/mcpGatewayDisabled.test.ts`
- `src/vs/workbench/contrib/mcp/test/electron-browser/mcpGatewayDisabled.test.ts`
- Этот отчёт.

## Результат

Browser gateway service больше не запрашивает remote connection и не вызывает remote IPC. Desktop gateway service больше не получает main-process channel в конструкторе и не вызывает local/remote gateway IPC. Оба варианта немедленно отклоняют createGateway с локализуемой ошибкой «MCP gateways are disabled in Myself IDE.», независимо от local/remote и наличия chatSessionResource. Desktop использует ту же неактивную реализацию через наследование; ложный gateway URL/result не возвращается.

Убраны runtime imports, создание McpGatewayToolBrokerChannel и регистрация local/remote broker channels из startup contributors. Эти contributors больше не материализуют IMcpService или remote/main-process/log services через DI. Сохранены явно неактивные compatibility classes, имена экспортов и существующие регистрации в contribution-файлах; общие contracts не менялись.

Потребители проверены поиском: регистрации сервисов и contributors остаются в browser/electron-browser `mcp.contribution.ts`, вызов service находится в MainThreadMcp. Его собственное отключение подготовлено другим агентом и этой задачей не изменяется. Области ранее готовых gallery/discovery/migration/API задач не затронуты.

## Проверки

- 8/8 целевых unit tests прошли в headless Chromium через Mocha, Playwright и esbuild из существующих зависимостей рабочего каталога; ошибок страницы нет. Для browser и desktop классов отдельно проверены создание gateway service и broker contribution через strict DI без инфраструктурных сервисов; явный отказ local/remote запросов с chatSessionResource и без него. Новые тесты сохранены в стандартных test/browser и test/electron-browser suites.
- Проверка чувствительности: подстановка четырёх исходных production-модулей из `59f0fde52ec` в память при bundling даёт 8 ожидаемых падений. Они обнаруживают прежние обязательные service dependencies и отсутствие явного отказа. Настоящие IPC/сеть не запускаются; эта проверка не измеряет трафик приложения.
- Учтена особенность browser assert shim: assert.rejects не проверяет ожидаемый текст ошибки; тесты явно сопоставляют результат отклонения через strictEqual, чтобы TypeError инфраструктуры не выдавался за ожидаемый отказ.
- Целевой ESLint всех шести TypeScript-файлов прошёл; после финального уточнения тестов их lint повторён. Команда: `pnpm dlx pnpm@12.16.0 run eslint <перечисленные выше TypeScript-файлы>`.
- Узкая проверка TypeScript через compiler API, настройки `src/tsconfig.json`, шесть изменённых файлов и существующие ambient declarations: 0 diagnostics.
- `git diff --check` прошёл. Временный browser harness удалён после проверок. Зависимости не обновлялись; общий typecheck, production bundle/package и native smoke не запускались.

## Интегратору

Ветка независима от предыдущих task-веток: база main, подключения в общих entrypoints не нужны. Перенести `428069c6e2a`, `74de60bebe0` и финальный коммит отчёта либо объединить task-ветку после review. После накопления общего пакета выполнить предусмотренные интеграционные проверки и native smoke.

Platform gateway/server реализации, их main/server channels и common broker channel implementation остаются вне области задания. Патч отключает только workbench adapters и startup brokers; это не полное удаление MCP/AI или доказательство отсутствия любых TCP listeners по другим путям. Обычные SSH/remote services, Terminal/Tasks, authentication и extension API не менялись. В main не объединено, самостоятельного релиза нет.
