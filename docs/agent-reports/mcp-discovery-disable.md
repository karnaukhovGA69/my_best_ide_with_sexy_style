# mcp-discovery-disable

Статус: реализация завершена, готова к интеграции; не брать повторно. Владелец: агент MCP-аудита и gallery-disable. Ветка: `agent/mcp-discovery-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpDiscovery.ts`, `src/vs/workbench/contrib/mcp/browser/mcp.contribution.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcp.contribution.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpDiscovery.test.ts`, `src/vs/workbench/contrib/mcp/test/electron-browser/mcpDiscoveryRegistration.test.ts`, этот отчёт. Не назначать второго владельца этих файлов.

Цель: убрать автоматическое обнаружение MCP из startup-графа, регистрацию discovery providers и config/policy listeners; старые настройки не должны снова включать discovery. Сохранить совместимость остальных MCP/Chat сервисов. Не менять gallery/IPC из предыдущего задания, PDF/documents, authentication, terminal/Tasks, extension API, общие workbench entrypoints, package/build/lockfiles. Полная сборка/релиз остаются интегратору.

## Результат (2026-11-05)

Удалён `browser/mcpDiscovery.ts`: больше нет `McpDiscovery`, его config/policy observables, autorun, DisposableStore и цикла создания/запуска/перезапуска discovery источников. Удалены его импорт и startup registration `registerWorkbenchContribution2('mcpDiscovery', ..., AfterRestored)` из `browser/mcp.contribution.ts`.

Из browser contribution удалены импорты и регистрации шести discovery descriptors: `RemoteNativeMpcDiscovery`, `InstalledMcpServersDiscovery`, `ExtensionMcpDiscovery`, `CursorWorkspaceMcpDiscoveryAdapter`, `WorkspaceDotMcpDiscovery`, `PluginMcpDiscovery`. Из electron-browser contribution удалён седьмой — `NativeMcpDiscovery`, его импорт и теперь неиспользуемый `SyncDescriptor`.

Настройки `chat.mcp.access` и управляемые allowlist больше не могут вернуть этот автоматический discovery-путь: startup contributor и его orchestration implementation удалены, а не закрыты дополнительным условием. Не запускаются соответствующие discovery `start()` и их watchers/listeners/активация провайдеров через этот путь. Пользовательские MCP-файлы не удаляются и не переписываются.

## Что сохранено

Оставлены `IMcpRegistry`/`McpRegistry`, `IMcpService`/`McpService`, desktop gateway registration и остальные MCP DI contracts, actions, UI, language features, resource filesystem, migration/management. Публичный extension API не менялся. Обычные Git/auth, SSH/remote, terminal/Tasks, settings, IntelliSense, PDF и documents UI не менялись.

Исходники discovery adapters и общий `IMcpDiscovery`/`mcpDiscoveryRegistry` ещё существуют; `PluginMcpDiscovery` и связанные utilities могут оставаться транзитивно импортированными другими UI-модулями. Нет заявления, что удалён весь их source/bundle или весь MCP. В production `src` после патча не осталось регистрации/чтения `mcpDiscoveryRegistry` вне самого определения; обращения `getAll()` остались в regression tests. Нет оставшихся импортов удалённого browser controller и ссылок на его startup ID.

Отдельные пути MCP по-прежнему возможны: прямые API/ручные действия, server transports, management/scanner/watchers, shared Chat и registration providers вне удалённого startup-контроллера. Этот патч не гарантирует отсутствие вообще всех MCP файловых/сетевых обращений и не заменяет будущую API/runtime очистку.

## Проверки

- Целевой ESLint двух contribution-файлов и двух tests пройден. Первоначальные предупреждения tests об отсутствии `ensureNoDisposablesAreLeakedInTestSuite` исправлены; финальные suites используют проверку утечек.
- `test/browser/mcpDiscovery.test.ts` заменяет прежний тест политики запуска удалённого controller двумя tests: импорт настоящего browser contribution оставляет discovery registry пустым; DI contracts `IMcpRegistry`/`IMcpService` сохранены.
- Новый `test/electron-browser/mcpDiscoveryRegistration.test.ts` проверяет после импорта настоящих browser и desktop contributions отсутствие всех discovery descriptors и сохранение native gateway override для существующих callers.
- Эти 4 regression tests и 36 существующих tests `src/vs/platform/mcp/test/common/allowedMcpServersService.test.ts` прошли: 40/40. Сохраняемая политика ручных MCP-путей не отключалась. Запуск: целевой esbuild bundle реальных модулей, Mocha/headless Chromium, репозиторный assert shim; CSS/font/wasm assets исключены из тестового bundle. Native services не создавались и UI-приложение не запускалось. Это не полный штатный Electron runner и не native smoke.
- Проверка чувствительности: те же финальные tests с тремя исходными runtime-модулями базы `59f0fde52ec`, прочитанными через `git show` и поданными bundler без изменения checkout. Ожидаемо упали ровно два tests отсутствия discovery sources, остальные 38 прошли. На новой реализации 40/40 проходят. Тесты обнаруживают реальные прежние регистрации, а не сравнивают исходный текст.
- `git diff --check`, поиск потребителей удалённого модуля/startup ID/registry, проверка области файлов и отсутствия package/lockfile изменений выполнены. Зависимости своего worktree переиспользованы, установки и общие сборки не запускались.
- Full client typecheck, bundle/package, native/SSH/web smoke и измерения RAM/CPU не выполнялись. Runtime изменения — удаление imports/registrations/controller без новых DI интерфейсов; import graph проверен целевой транспиляцией. Общая интеграционная проверка остаётся перед выпуском пакета.

## Передача интегратору

Задача зарезервирована до реализации в общем каталоге отчётов и claim-коммите `f9a245ad20a`. Рабочая ветка `agent/mcp-discovery-disable` основана на main `59f0fde52ec`; она независима от `agent/mcp-gallery-disable`, файлы двух задач не пересекаются. Итоговый runtime/report commit: `git log -1 --format=%H agent/mcp-discovery-disable`.

Перенести два contribution-файла, удаление controller, оба tests и report вместе. Дополнительный wiring в общих workbench entrypoints, product/build/dependencies не требуется: существующие imports MCP contributions уже ведут на обновлённые модули. Common contribution используется desktop/web, также оставшимися Sessions исходниками; native добавка используется desktop. Не переносить node_modules/out/.build.

Обновлённая копия собственного отчёта оставлена в общем каталоге для видимого статуса. При переносе коммита учесть её как копию файла этой ветки. Main код и файлы других агентов не менялись. После интеграции в общий пакет проверить запуск clean/existing profile с `chat.mcp.access=all/registry/none`, старой MCP-конфигурацией и managed policy: discovery не появляется, обычные remote/Git/terminal/Tasks/settings/extension сценарии сохранены. Публичный релиз не создан.
