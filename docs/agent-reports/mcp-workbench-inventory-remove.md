# mcp-workbench-inventory-remove

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-workbench-inventory-remove`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts`, `src/vs/workbench/contrib/mcp/test/browser/mcpWorkbenchService.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: удалить eager workbench MCP inventory/gallery/profile sync, URL handler, install/uninstall/config/editor implementation и контекстную инициализацию с I/O. Сохранить IMcpWorkbenchService-compatible facade с пустыми inventory/pager, завершённой readiness, явным отказом mutating/UI операций и неактивными events; MCP contexts выставлять false/unavailable без queryLocal. Не менять общий management/scanner/gallery, contribution-файлы, contracts, main/build/dependencies и чужие области. Целевые проверки; общая интеграция остаётся интегратору.
