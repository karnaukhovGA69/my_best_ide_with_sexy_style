# mcp-resource-filesystem-disable

Статус: ГОТОВО к интеграции; повторно не назначать. Владелец: агент MCP audit/gallery/discovery/migration/workbench-gateway. Ветка: `agent/mcp-resource-filesystem-disable`. База: `59f0fde52ec`.

Задача A05. Резервирование до реализации: `c608e8c5531`; отметка сразу помещена в собственный отчёт общего checkout. Код и тесты: `49fa206f5b6` (`Remove MCP resource filesystem provider implementation`).

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpResourceFilesystem.test.ts` и этот отчёт.

Удалена реализация MCP resource filesystem: регистрация провайдера `mcp-resource`, чтение/stream/stat/readdir ресурсов, запуск сервера для watch, resource subscriptions и autorun, lazy обращение к IMcpService, обращения к web content extractor, кратковременный кэш с cancellation pools и таймером очистки. Сам provider interface и его методы больше не реализуются.

Сохранён явно неактивный compatibility class `McpResourceFilesystem extends Disposable`, без constructor/service dependencies и runtime imports MCP. Существующий BlockRestore contribution может создаваться и освобождаться, но ничего не регистрирует. Contribution-файл не менялся, поэтому нет пересечения с ранее подготовленной discovery-веткой.

Поиск в `src` и `extensions` выявил единственного production-потребителя класса — import/registration в `browser/mcp.contribution.ts`; внешних вызовов удалённых методов класса там нет. FileService, обычные filesystem providers, MCP contracts, общие entrypoints и области platform gateway/sampling/voice других агентов не менялись. Личные файлы, профили и настройки не читались и не изменялись.

## Проверки

- 6/6 новых unit tests прошли через временный esbuild/Mocha/Playwright harness в headless Chromium из существующих зависимостей рабочего каталога. Ошибок страницы нет; включён штатный disposable leak checker.
- Проверены strict DI без infrastructure services и повторный dispose; отсутствие provider registration при старте, activateProvider и dispose; readFile/readFileStream/stat сохранённого MCP URI через настоящий FileService дают отсутствие провайдера, без обращений к тестовым MCP/web extractor services.
- Через настоящий FileService и штатный InMemoryFileSystemProvider проверены запись и чтение кириллицы, переименование, повторная запись/чтение и удаление обычного файла до/после dispose. Другой провайдер остаётся зарегистрированным. Это in-memory сценарий, не native filesystem smoke.
- Контроль чувствительности: исходный production-модуль из `59f0fde52ec` подставлен в память bundler без изменения checkout; все 6 тестов дали ожидаемые падения из-за service dependencies, регистрации MCP provider и обращения к MCP. Никакие настоящие серверы или web extraction не запускались.
- Прежние 9 тестов поддержки удалённого MCP filesystem заменены этими 6 регрессиями; новые проверки соответствуют отключённому поведению.
- Целевой ESLint обоих файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts src/vs/workbench/contrib/mcp/test/common/mcpResourceFilesystem.test.ts`. После уточнения return type тестового getter его файл перепроверен.
- Узкая проверка TypeScript с options `src/tsconfig.json`, двумя изменёнными файлами и существующими ambient declarations: 0 diagnostics без фильтрации. Runtime-проверки переиспользованы после изменения только type annotation.
- `git diff --check` прошёл; временный harness удалён. Зависимости не обновлялись. Полные typecheck/build/package и native smoke не запускались.

## Интегратору и ограничения

Ветка основана на main и не зависит от других task-веток. Дополнительных подключений не требуется. Для переноса использовать `c608e8c5531`, `49fa206f5b6` и финальный коммит отчёта либо merge ветки после review; включить в общий пакет с предыдущими задачами.

Сохранённые `mcp-resource:` URI больше не обслуживаются встроенным провайдером и получают штатную ошибку отсутствия filesystem provider. Перед выпуском проверить восстановление окна с ранее открытым MCP resource и обычным локальным/remote файлом в общем native smoke. Патч не удаляет сами сохранённые URI или данные и не подменяет их пустым содержимым.

Это удаление одного встроенного MCP resource filesystem, а не всего MCP/AI или инфраструктуры чтения файлов. Другие MCP callers и сторонние extension filesystem providers вне области задания остаются. В main ещё не объединено; сборка и релиз остаются интегратору.
