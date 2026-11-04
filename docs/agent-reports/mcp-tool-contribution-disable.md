# mcp-tool-contribution-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-tool-contribution-disable`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `fd524d34426`; копия отметки сразу помещена в собственный отчёт общего checkout. Код и тесты: `8f2483ee777` (`Remove MCP language model tool contribution implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts`, новый `src/vs/workbench/contrib/mcp/test/common/mcpLanguageModelToolContribution.test.ts` и этот отчёт.

Удалена startup-синхронизация MCP tools с ILanguageModelToolsService: чтение inventory/collections, autorun и подписки на metadata/enablement/tools, создание tool sets, регистрация и обновление tools, flush и shutdown-логика этого contributor. Удалён внутренний McpToolImplementation: подготовка и вызов MCP tool, обращения к серверу, преобразование результатов, чтение resource images через FileService и resize встроенных изображений. Эти общие services сами по себе не изменены.

Сохранён явно неактивный compatibility class `McpLanguageModelToolContribution extends Disposable` с прежним ID `workbench.contrib.mcp.languageModelTools`. Конструктор не требует сервисов, runtime imports MCP/chat/tool implementation убраны. Существующая регистрация AfterRestored остаётся совместимой, но ничего не публикует. Общие entrypoints и contribution-файл предыдущей discovery-ветки не менялись.

Поиск в `src` и `extensions` подтвердил, что единственный production-потребитель класса — import/registration в `browser/mcp.contribution.ts`. Удалённый McpToolImplementation был внутренним, не экспортировался. Общий tools service, API расширений, MCP sampling/dev-mode другого агента, FileService, image resize и lifecycle infrastructure не затронуты.

## Проверки

- 3/3 новых unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium с зависимостями собственного рабочего каталога. Page errors отсутствуют; включён штатный disposable leak checker.
- Strict DI без infrastructure services и повторный dispose. Два сценария inventory: пустой на старте и уже содержащий включённый сервер с модельным tool. Затем добавление сервера, изменение списка tools, выключение/включение сервера, изменение collections, удаление сервера и обновление после dispose. Во всех случаях нет чтений наблюдаемых inventory/collections, tool registration/createToolSet/addTool/flush/disposeToolSet и invoke.
- Тесты используют реальные observableValue/derived и InstantiationService; MCP/registry/tools services заменены тестовыми объектами. Серверы, модели, файлы и сеть реально не вызывались. Общий tools service на настоящих инструментах этим suite не проверялся.
- Контроль чувствительности: исходный production-модуль из `59f0fde52ec` подставлен в память bundler без изменения checkout. Все 3 теста ожидаемо падают: strict DI обнаруживает старые dependencies, inventory-тесты фиксируют чтения, создание tool sets, регистрацию/addTool и flush. Page errors нет.
- Целевой ESLint обоих TypeScript-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts src/vs/workbench/contrib/mcp/test/common/mcpLanguageModelToolContribution.test.ts`. После уточнения типа тестового tool set его файл перепроверен.
- Узкий TypeScript noEmit через compiler API с настройками `src/tsconfig.json`, двумя файлами и существующими ambient declarations: 0 diagnostics без фильтрации. Runtime-результаты переиспользованы после изменения только type annotation/import типа IDisposable.
- `git diff --check` прошёл. Временный harness удалён. Зависимости не обновлялись; полный client typecheck, production build/package и native smoke не запускались.

## Интегратору и ограничения

Ветка независима от предыдущих task-веток, основана на main. Дополнительных подключений не требуется. Перенести `fd524d34426`, `8f2483ee777` и финальный коммит отчёта либо merge task-ветки после review. Включить в накопленный пакет и выполнить общие интеграционные проверки/native smoke перед релизом.

Патч удаляет только встроенный MCP-to-language-model tools contributor и его adapter, а не весь MCP/AI или общую tools infrastructure. Прямые MCP вызовы других компонентов, extension tools API и прочие adapters вне области задания остаются. В main ещё не объединено; самостоятельной сборки и релиза нет.
