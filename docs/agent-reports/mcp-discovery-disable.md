# mcp-discovery-disable

Статус: ЗАНЯТО / в работе. Владелец: агент MCP-аудита и gallery-disable. Ветка: `agent/mcp-discovery-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpDiscovery.ts`, `src/vs/workbench/contrib/mcp/browser/mcp.contribution.ts`, `src/vs/workbench/contrib/mcp/electron-browser/mcp.contribution.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpDiscovery.test.ts`, новые целевые тесты discovery registration в том же test-каталоге, этот отчёт. Не назначать второго владельца этих файлов.

Цель: убрать автоматическое обнаружение MCP из startup-графа, регистрацию discovery providers и config/policy listeners; старые настройки не должны снова включать discovery. Сохранить совместимость остальных MCP/Chat сервисов. Не менять gallery/IPC из предыдущего задания, PDF/documents, authentication, terminal/Tasks, extension API, общие workbench entrypoints, package/build/lockfiles. Полная сборка/релиз остаются интегратору.
