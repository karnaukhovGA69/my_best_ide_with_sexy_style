# mcp-migration-disable

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit/gallery/discovery. Ветка: `agent/mcp-migration-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpMigration.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpMigration.test.ts` и этот отчёт. Не назначать второго владельца этой области.

Задача: удалить автоматические чтение/перенос/удаление MCP-конфигурации из local/remote settings, startup watchers, уведомления и вызовы install/command из migration contributor. Сохранить небольшой stateless compatibility export для существующей регистрации, чтобы не пересекаться с contribution-файлами уже подготовленной discovery-ветки. Пользовательские файлы не менять. Не трогать MCP API другого агента, gallery/discovery, документы/PDF, authentication, Terminal/Tasks, общие entrypoints, main/build/package/lockfiles. Полная сборка и релиз остаются интегратору.
