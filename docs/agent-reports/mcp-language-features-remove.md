# mcp-language-features-remove

Статус: ЗАНЯТО / в работе. Владелец: агент MCP audit и workbench cleanup. Ветка: `agent/mcp-language-features-remove`. База: `59f0fde52ec`.

Зарезервировано до реализации: `src/vs/workbench/contrib/mcp/browser/mcpLanguageFeatures.ts`, новый `src/vs/workbench/contrib/mcp/test/browser/mcpLanguageFeatures.test.ts` и этот отчёт. Не назначать второго владельца.

Задача A05: удалить реализацию MCP-specific CodeLens/inlay hints, diagnostics, model cache и подписки на chat/agent-host/secrets. Сохранить неактивный compatibility export для существующей регистрации Eventually. Общие IntelliSense/language registries/markers/secret storage и обычные провайдеры не менять; contribution-файлы, main, build, API, зависимости и области других агентов не трогать. Проверить отсутствие регистрации MCP providers и сохранение обычных language providers. Интеграция и общая сборка остаются интегратору.
