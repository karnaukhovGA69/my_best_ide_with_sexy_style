# mcp-language-features-remove

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-language-features-remove`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `d0883761286`; копия сразу помещена в собственный отчёт общего checkout. Реализация и тесты: `3818e4fee86` (`Remove MCP editor language feature implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/browser/mcpLanguageFeatures.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpLanguageFeatures.test.ts` и этот отчёт.

Из production-модуля удалена 741 строка прежней реализации: MCP-specific CodeLens и inlay hint providers для mcp.json/.mcp.json/workspace.json; разбор/кэш модели и слушатели её изменений; диагностика MCP variables; построение команд управления MCP servers/agent-host servers, подсказок сохранённых inputs и действий над OAuth secrets; подписки на chat focus/session, Agent Host connections/actions/customizations и secret changes. Кнопки не просто скрыты настройкой: реализация этих providers удалена.

Оставлен небольшой явно неактивный compatibility class `McpLanguageFeatures extends Disposable`, без service dependencies и runtime imports MCP/chat/Agent Host. Он нужен для существующей регистрации Eventually. Contribution-файл прежней discovery-ветки не менялся. Поиск по `src` и `extensions` подтвердил единственный production-потребитель класса: import/registration в `browser/mcp.contribution.ts`; экспортируемых helper-функций в удалённой реализации нет.

Общие LanguageFeaturesService/registries, IntelliSense, MarkerService, secret storage, configuration resolver, Agent Host и chat services не изменены. Файлы, settings, сохранённые секреты и MCP inputs пользователя не читались и не удалялись. MCP config service/dev-mode/sampling и области других агентов не затронуты.

## Проверки

- 3/3 новых browser unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium из существующих зависимостей рабочего каталога. Page errors нет; включён disposable leak checker.
- Strict DI без infrastructure services и повторный dispose. Настоящий LanguageFeaturesService проверяется на отсутствие регистрации MCP CodeLens/inlay hints. События секретов, chat widget/session, connections, customizations и inputs подаются через реальные Emitter; проверяется отсутствие подписок до dispose и отсутствие обращений к сервисам/изменений registry после событий и dispose.
- Отдельно проверено сохранение зарегистрированных обычных completion/CodeLens/inlay providers до и после dispose. Это проверка реестров с тестовыми providers, а не end-to-end IntelliSense или запуск языкового расширения.
- Контроль чувствительности: исходный production-модуль из `59f0fde52ec` подставлен в память bundler без изменения checkout; все 3 теста ожидаемо падают. Выявлены прежние обязательные dependencies, два MCP providers, подписки и чтения состояния сервисов. Page errors нет. После добавления обязательного `_debugDisplayName` тестовому completion provider текущий набор повторно прошёл.
- Целевой ESLint двух TS-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/browser/mcpLanguageFeatures.ts src/vs/workbench/contrib/mcp/test/browser/mcpLanguageFeatures.test.ts`. После уточнения теста его файл перепроверен.
- Узкая TypeScript noEmit проверка через compiler API с options `src/tsconfig.json`, двумя файлами и транзитивными imports: 0 diagnostics без фильтрации. Явно включены существующие Node/src/typings declarations, `src/vs/monaco.d.ts` и `src/vs/workbench/contrib/debug/common/debugProtocol.d.ts`, необходимые этому графу. Первый запуск выявил отсутствие этих globals в harness и обязательного поля тестового provider; финальная проверка прошла после исправления.
- `git diff --check` прошёл. Временный harness удалён. Зависимости, build и lockfiles не менялись; полный client typecheck, production bundle/package и native smoke не запускались.

## Интегратору и ограничения

Ветка независима от предыдущих task-веток и основана на main. Дополнительных подключений не требуется. Перенести `d0883761286`, `3818e4fee86` и финальный коммит отчёта либо merge ветки после review. Включить в общий пакет и проверить обычное редактирование JSON/settings, completion, стандартные language providers и отсутствие MCP-specific lenses/hints при native smoke.

Обычная JSON/schema validation может продолжать работать: общая инфраструктура и схемы этим заданием не удалялись. Другие MCP UI/actions/commands и providers вне этого класса также остаются; это не полное удаление MCP/AI. В main ещё не объединено, самостоятельной сборки или релиза нет.
