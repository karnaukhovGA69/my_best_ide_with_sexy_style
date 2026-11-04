# mcp-api-disable

Статус: ГОТОВО к интеграции; main и релиз не изменялись. Владелец: агент ранее documents-ui и ai-terminal-cleanup. Ветка: `agent/mcp-api-disable`. База: `59f0fde52ec`. Резервирование до реализации: `91ae60e8241`. Реализация и тесты: `7451c87f03d`.

## Область

Только `src/vs/workbench/api/browser/mainThreadMcp.ts`, `src/vs/workbench/api/common/extHostMcp.ts`, `src/vs/workbench/api/node/extHostMcpNode.ts`, соответствующие три MCP test-файла в `api/test/{browser,common,node}/` и этот отчёт. Работа независима от mcp-discovery-disable, mcp-gallery-disable, mcp-migration-disable, terminal cleanup, voice cleanup и documents-ui. Общие entrypoints, protocol, API declarations, dependencies и build pipeline не менялись.

## Реализация

- Сохранены `IExtHostMpcService`, `ExtHostMcpService`, `NodeExtHostMpcService`, именованный RPC customer `MainThreadMcp` и все методы существующих RPC shapes. Node implementation переиспользует общий неактивный API; существующие DI registration/import paths продолжают работать без подключения новых сервисов.
- Регистрация необязательного MCP provider возвращает disposable, не читает его свойства, не вызывает callbacks и не хранит provider. Обычная активация расширения и регистрация команд остаются возможны. Список MCP definitions всегда пустой и неизменяемый; события не отправляются. Начальное ожидание providers завершается сразу.
- Удалены stdio child-process adapter, env-file чтение, HTTP/SSE/undici transport, MCP OAuth discovery/dynamic token code, registry delegate, auth/policy/startup listeners, observable scheduler и фоновый RPC из этих модулей. Исходные MCP-only helper exports имели потребителей только в этих модулях и заменённых тестах; внешние импорты проверены по `src` и `extensions`.
- Явный transport start, send и gateway start завершаются локализованной ошибкой недоступности. URL checks возвращают отказ; MCP token requests возвращают undefined без использования auth services. Late RPC notifications, stop и dispose безопасны. Compatibility helpers не читают окружение, файлы и workspace variables, не показывают prompts.
- Общий GitHub authentication, SSH, commands, language features, formatter services и классы публичного API в extHostTypes не менялись. Общие реализации MCP вне этой области ещё присутствуют; это не заявление о полном удалении MCP/AI из продукта.

## Проверки

- Целевой `pnpm run eslint` всех шести изменённых TypeScript-файлов — успешно. После изменения тестовых данных lint соответствующего файла повторён; `git diff --check` — успешно.
- 13 новых регрессионных тестов трёх MCP suites — успешно в Chromium через временный esbuild/Mocha harness с реальными исходными модулями, включая проверку disposable leaks. Проверяются DI без сервисов, отсутствие timers и чтения providers/launch/metadata, блокировка transport/gateway, неизменяемость definitions, отсутствие expansion и выполнение обычной extension-команды.
- Дополнительно Node MCP suite выполнен в Node: 2/2 успешно. Это те же два теста из 13, а не дополнительные уникальные сценарии.
- 26 существующих тестов — успешно в Chromium: `ExtHostCommands`, `TokenStore`, `DynamicAuthProvider`, `Account Icon Revival`, а также `ExtHostLanguageFeatures` с селектором `Suggest|Parameter Hints|Format`. Они проверяют сохранённые команды, auth и языковые механизмы на исходном уровне; не заменяют UI/native smoke.
- Узкий TypeScript noEmit для шести изменённых файлов, деклараций проекта и транзитивных зависимостей — 0 diagnostics (1424 файла графа, без фильтрации ошибок; options из `src/tsconfig.json`, Node types подключены явно). Проверены реализации существующих RPC contracts. Это не полный client typecheck.
- Сначала harness выявил отсутствующий метод в command mock и два некорректных тестовых типа; исправлены. Первоначальная Node harness несовместимость разрешения Sinon исправлена в локальном runner; итоговый Node прогон успешен. Продуктовый код не подменялся mocks.

## Интегратору

Перенести ветку целиком от `59f0fde52ec` либо cherry-pick реализации `7451c87f03d` с итоговым отчётом. Новое подключение в shared entrypoints не требуется: имена и пути модулей сохранены. Конфликтов по заявленным областям с другими MCP-задачами нет.

В общем checkout до реализации был создан незакоммиченный файл-резервация этого отчёта, затем обновлён этим текстом. Если он блокирует cherry-pick, сверить и заменить только этот собственный файл версией из task-ветки, сохранив чужие отчёты.

Полная сборка, полный client typecheck, native/web/remote extension-host smoke и публикация релиза намеренно не запускались согласно правилу пакетной сборки. Интегратору проверить их на общем дереве, включая активацию стороннего расширения с необязательным MCP, обычную команду, GitHub auth, подсказки и ручное форматирование. Исходные API symbols сохранены, но end-to-end запуск реального стороннего расширения в новом packaged IDE этим заданием не проверен.
