# mcp-copilot-config-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент ранее mcp-devmode-disable и mcp-sampling-disable. Ветка: `agent/mcp-copilot-config-disable`. База: `59f0fde52ec`. Claim до реализации: `f7cf152bb1b`; реализация и тесты: `13daad20a21`. Main и бинарный релиз не менялись.

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/common/mcpCopilotGlobalConfigurationService.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcpCopilotGlobalConfigurationService.ts`, соответствующие common и electron-browser tests с тем же именем, этот отчёт. Резервация создана в общем checkout до реализации. Задача A05 независима от других MCP/voice задач.

Сохранены `IMcpCopilotGlobalConfigurationService`, decorator, common class и desktop export `NativeMcpCopilotGlobalConfigurationService`. `getConfigurationResource()` всегда возвращает undefined, означающий недоступность конфигурации по существующему контракту. Desktop export переиспользует общий неактивный сервис.

Удалены зависимости от Agent Host enablement, remote agent, main-process IPC и logger, проверка enablement, получение локальных/удалённых discovery data, ProxyChannel и native discovery channel acquisition, вычисление Copilot config URI, 5-секундный timeout и warning path. Изменение enablement и доступность remote не могут включить этот сервис. Пользовательские файлы и настройки не читались и не менялись при выполнении задания.

## Потребители и границы

Поиск импортов/методов выполнен по `src` и `extensions`. Сохранённые consumers: common/desktop contribution registrations, `McpAddConfiguration`, команды открытия user/remote MCP configuration, `McpWorkbenchService.resolveEditableMcpServerConfiguration`, Agent Host MCP migration provider и тестовые fixtures. Protected local loader использовался только native implementation и заменённым тестом; остальные exports сохранены. Для применения не нужны новые registrations или shared wiring.

Consumers уже обрабатывают undefined. Editable configuration path прекращает Copilot file read; add/open configuration commands могут использовать существующий legacy VS Code MCP configuration fallback. Эти команды/UI, platform discovery helpers, migration provider, general remote/SSH services, MCP contracts, пользовательские файлы, main/build/dependencies не менялись. Поэтому патч не отключает все MCP settings/команды/миграции и не доказывает отсутствие всей MCP/AI сетевой активности.

## Проверки

- 6/6 целевых тестов прошли в headless Chromium через временный esbuild/Mocha harness реальных исходных модулей; 0 failures/page errors, штатная проверка disposable leaks. Проверены strict DI без infrastructure services, enablement false → true, конкурентные запросы, доступный/ошибочный/неотвечающий remote discovery, native local path, нулевые обращения к connection/channel/load/logger и отсутствие оставшихся timers. В pending-сценарии fake clock продвинут на 5001 ms, чтобы baseline comparison также завершался.
- Контроль чувствительности: те же 6 тестов с исходными common/native modules из `59f0fde52ec`, подставленными в память bundler, дали 6 ожидаемых падений и 0 page errors. Обнаружены старые DI dependencies, возвращаемый Copilot URI и реальные обращения к тестовым connection/channel/load/warn. Реальная сеть и пользовательские профили не использовались; checkout не менялся.
- 3 существующих теста `mcpConfigurationEntryPoints.test.ts` с селектором `unavailable Copilot configuration|opens VS Code user configuration without prompting` прошли без page errors. Это проверка прежнего unavailable/fallback контракта commands с их тестовыми service fixtures; не packaged end-to-end smoke.
- Узкий TypeScript noEmit четырёх изменённых файлов с ambient declarations и транзитивными зависимостями: 693 файла графа, 0 diagnostics без фильтрации. Options из `src/tsconfig.json`, Node types явно подключены; полный client typecheck не запускался.
- Целевой ESLint четырёх TS-файлов и `git diff --check` прошли. Собственные зависимости рабочего каталога переиспользованы. Launcher использовал pnpm 11.25.0 при закреплённом 12.16.0; package/lockfiles не менялись.

## Интегратору

Перенести `agent/mcp-copilot-config-disable` целиком либо implementation `13daad20a21` с отчётом. Common и native implementations переносить вместе: native ранее наследовал удалённый local-loader method. Ветка основана на main и не зависит от прежних task-веток. Общие entrypoints/contributions остаются совместимыми.

В общем checkout незакоммиченная копия этого отчёта — наша резервация, обновлённая результатом. Если она мешает cherry-pick, сверить и заменить только этот файл версией task-ветки, сохраняя чужие отчёты. На общем output выполнить common/electron-browser `mcpCopilotGlobalConfigurationService.test.js` и релевантные configuration entrypoint tests штатным runner.

Полные type/DI checks, production package, native Electron, реальное SSH-подключение и релиз не запускались по правилу пакетных сборок. Chromium-проверка desktop export не является native smoke; итоговый релизный цикл остаётся интегратору.
