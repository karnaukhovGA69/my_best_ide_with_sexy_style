# mcp-lifecycle-commands-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-lifecycle-commands-remove`. База main `411cccde06e` + browse-prompt/action-rendering branches. Claim `70897d1db58`. Код/тесты: `5a511c2ddb5fd8b09336f87bf55eeb1a42bec368`. Следующий пакет после release-0.0.9.

В browser/mcpCommands.ts удалены ListMcpServerCommand runtime/private methods и list-only buttons/helpers, плюс implementations RestartServer/StartServer/StopServer/ResetMcpTrustCommand/ResetMcpCachedTools/McpSkipCurrentAutostartCommand. Сохранены Action2 identities/metadata/argument types; запуск явно отказывает до чтения services/arguments. Удалены picker loops/collection activation и прямые local/agent-host lifecycle/reset calls в этих командах. Также удалены два осиротевших type-guard/lookup helpers, выявленных узким typecheck.

Новый test/browser/mcpLifecycleCommands.test.ts: 7 tests с undefined/local/wildcard/agent-host/trap arguments проходят. 7 соседних command tests и 57 configuration entry point tests проходят; ESLint прошёл, итоговый узкий TypeScript — 0 diagnostics; git diff --check прошёл. Первый edit script завершился до записи из-за опечатки JS index/indexOf: все 7 новых tests тогда ожидаемо падали на прежнем runtime; после исправления и удаления orphan helpers проверки успешны.

AgentHostServerOptions/ServerOptions, MCP-specific auth/storage UI, manual configuration и shared lifecycle helper для options UI сохранены. Общие authentication APIs и GitHub/Git/SSH не редактировались. Поэтому полный запрет MCP lifecycle во всех оставшихся options UI не заявляется. Интегрировать после mcp-action-rendering-runtime-remove (`08c1949b597`) и его browse dependency; цепочка уже в ветке. Полный typecheck/build/package/native smoke — на следующем пакете.
