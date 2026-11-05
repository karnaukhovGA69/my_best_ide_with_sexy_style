# mcp-migration-disable

Статус: ГОТОВО к интеграции. Владелец: агент MCP audit/gallery/discovery. Ветка: `agent/mcp-migration-disable`. База: `59f0fde52ec`.

Задача и область были заняты до реализации: коммит `28e0342b68b`, копия статуса в общем checkout. Реализация и тесты: `c0372ffb7d6` (`Disable automatic MCP configuration migration`). В main не интегрировано; сборка и выпуск остаются интегратору.

## Область и результат

Изменены только `src/vs/workbench/contrib/mcp/browser/mcpMigration.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpMigration.test.ts` и этот отчёт.

Удалена автоматическая миграция MCP-конфигурации из локальных и удалённых пользовательских settings: чтение/парсинг, install серверов, удаление секции `mcp`, запрос remote environment, файловые watchers и listeners, уведомления с действиями миграции/открытия конфигурации и вызовы команд. Пользовательские файлы при выполнении задания не менялись.

Сохранён явно неактивный compatibility class `McpConfigMigrationContribution` с прежним ID, наследованием Disposable и без service dependencies. Существующая регистрация contributor в Eventually остаётся совместимой, но больше не выполняет миграцию. Contribution-файлы не менялись, поэтому задача не пересекается с подготовленной веткой discovery. MCP API другого агента и остальные области не затронуты.

## Проверки

- 4/4 новых browser unit tests прошли в headless Chromium через Playwright, Mocha и esbuild из установленных зависимостей рабочего каталога. Проверены создание через strict DI без infrastructure services; legacy MCP settings; повреждённые settings; обычные settings без remote. Тесты подают изменения обоих settings-ресурсов и проверяют отсутствие обращений к сервисам и подписок до dispose. Fixtures вымышленные, файловая система и network services заменены тестовыми объектами.
- Контроль чувствительности: тот же набор с исходным `mcpMigration.ts` из базы `59f0fde52ec`, подставленным в память при bundling, дал 4 ожидаемых падения. Они выявляют service dependencies и старые read/install/write/watch/prompt операции; checkout для этой проверки не изменялся.
- Целевой ESLint двух изменённых TypeScript-файлов прошёл: `pnpm dlx pnpm@12.16.0 run eslint src/vs/workbench/contrib/mcp/browser/mcpMigration.ts src/vs/workbench/contrib/mcp/test/browser/mcpMigration.test.ts`.
- Узкая проверка TypeScript через compiler API с настройками `src/tsconfig.json`: два изменённых файла плюс существующие ambient declarations; 0 diagnostics. Полный client typecheck не запускался.
- `git diff --check` прошёл. Временные browser harness/bundle удалены после проверок; постоянные тесты сохранены в репозитории.

## Интегратору и ограничения

Подключения в общих entrypoints не нужны: существующий import/export и ID сохранены. Ветка основана на main и не зависит от коммитов gallery/discovery/API; объединять её с остальными готовыми изменениями пакетом. При cherry-pick переносить `28e0342b68b`, `c0372ffb7d6` и завершающий коммит отчёта из этой ветки.

Это отключение одного автоматического migration contributor, а не заявление о полном удалении MCP или AI. Другие MCP services, commands и пути миграции вне этого класса не менялись. Полная интеграционная проверка, production bundle/package и native smoke не проводились и остаются в общем релизном цикле интегратора; самостоятельного релиза нет.
