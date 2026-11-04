# mcp-resource-filesystem-disable

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit/gallery/discovery/migration/workbench-gateway. Ветка: `agent/mcp-resource-filesystem-disable`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts`, `src/vs/workbench/contrib/mcp/test/common/mcpResourceFilesystem.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: убрать регистрацию MCP resource filesystem и реализацию чтения/подписок/кэша с таймерами и вызовов MCP server/web extractor. Сохранить неактивный compatibility export для существующего BlockRestore contribution. Проверить отсутствие регистрации MCP provider и сохранение обычных файловых операций. Не менять contribution-файлы прежней discovery-ветки, platform gateway другого агента, general FileService/providers, MCP contracts, main, entrypoints, зависимости и build. Полная интеграция и сборка остаются интегратору.
