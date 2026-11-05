# mcp-tool-broker-remove

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-tool-broker-remove`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `f1e88cd8b57`; копия сразу помещена в собственный отчёт общего checkout. Код и тесты: `973922ebf20` (`Remove MCP gateway tool broker implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts` и этот отчёт.

Удалены MCP inventory reads, три autorun и emitters, startup grace cache с 5-секундными timeout races, ожидание/запуск сервера, перечисление tools/resources/templates через MCP server, вызов tools, чтение resources, parsing chat-session URI и logging аргументов. Общие IPC/event/lifecycle utilities не менялись.

Остался совместимый McpGatewayToolBrokerChannel: четыре list-операции возвращают пустые массивы; три известных события возвращают Event.None; callToolForServer/readResourceForServer отклоняются локализованной ошибкой недоступности. Аргументы запроса и cancellation token не читаются. Неизвестные call/listen операции по-прежнему дают ошибки. Constructor принимает прежние MCP service/logger/grace arguments как необязательные и не сохраняет/не читает их; это сохраняет компиляцию старых прямых new-вызовов.

Проверка потребителей в src/extensions: direct constructor calls находятся в browser/electron-browser broker contributions (их удаление подготовлено отдельной workbench-gateway веткой). Platform gateway channel использует сохранённые IPC имена (его отключение подготовил другой агент). Данная ветка независима от обоих изменений и не меняет их файлы. IMcpService, общие transport/protocol contracts, main/build/dependencies не затронуты.

## Проверки

- 6/6 unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium с собственными установленными зависимостями. Page errors нет; включён disposable leak checker.
- Создание/dispose без services; legacy constructor с observable MCP inventory и poison logger; отсутствие чтений/событий при изменении inventory; пустые результаты всех list-команд с отсутствующими/null/poison arguments и отменённым token.
- Tool/resource calls дают точный отказ до чтения poison arguments/token. Unknown call/listen дают явные ошибки. Проверены три inert event subscription.
- Один тест проводит реальный ChannelClient/ChannelServer roundtrip через in-memory message protocol: четыре пустых списка, два отказа, неизвестная команда, подписки без событий. Это тест общего IPC dispatch/serialization без открытия native MCP gateway/socket; не запуск packaged приложения.
- Контроль чувствительности: два constructor tests с исходным production-модулем из `59f0fde52ec`, подставленным в память bundler, ожидаемо падают на обращении к logger. Остальные четыре теста на старой реализации не запускались. Checkout не изменялся, page errors нет.
- Прежние тесты работающего broker/startup grace заменены регрессиями удалённого поведения. Новый код не создаёт timers/cache; отдельное измерение таймеров приложения не проводилось.
- Целевой ESLint обоих файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts src/vs/workbench/contrib/mcp/test/common/mcpGatewayToolBrokerChannel.test.ts`.
- Узкая TypeScript noEmit проверка двух файлов с транзитивными imports, options `src/tsconfig.json` и существующими ambient declarations: 0 diagnostics без фильтрации. Это не полный client typecheck.
- `git diff --check` прошёл, временный harness удалён. Зависимости не обновлялись; production bundle/package/native smoke не запускались.

## Интегратору и ограничения

Перенести `f1e88cd8b57`, `973922ebf20` и финальный коммит отчёта либо merge task-ветки после review. База main; новых подключений не требуется. Объединить с уже подготовленными workbench/platform gateway задачами в общий пакет и выполнить интеграционный/native smoke перед выпуском.

Удалён один gateway broker endpoint; другие прямые MCP tools/resources/transport callers вне этой области остаются. Не заявлять полное удаление MCP/AI или отсутствие всех сетевых путей. В main ещё не объединено; самостоятельной сборки и релиза нет.
