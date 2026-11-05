# mcp-install-actions-runtime-remove

Статус: ГОТОВО / ожидает интеграции. Владелец: MCP cleanup. Ветка: `agent/mcp-install-actions-runtime-remove`. База main `411cccde06e`. Claim `500be73befe`. Код/тесты: `6c86b4abd89b3a9956b04da3d6e07906c5045c75`. Следующий пакет после release-0.0.9.

В browser/mcpServerActions.ts удалены implementations InstallAction, InstallInWorkspaceAction и InstallInRemoteAction: catalog/install calls, target picker, alerts, telemetry events/classifications и post-install server startup. Сохранены action IDs/static classes/open argument для consumers; actions всегда disabled/hidden, run явно reject unavailable, без DI и чтения server metadata. Остальные actions/manual configuration не менялись.

Из common/mcpTypesUtils.ts полностью удалён осиротевший startServerByFilter (discovery observer/timeout/start). Поиск src/extensions/build TS/JS не находит его references и трёх mcp:action:install events. Остальные helper functions сохранены. В test/browser/mcpConfigurationEntryPoints.test.ts удалены tests прежних install/start-filter scenarios, добавлены 3 unavailable tests для всех actions с open true/false и null/trap server. Прочие destination/manual-file/configuration assertions сохранены.

44 browser tests проходят; lint трёх изменённых TS прошёл; узкий TypeScript с existing McpServerEditor consumer root — 0 diagnostics; git diff --check прошёл. Diff: 354 строки удалено, 29 добавлено. Новые constructor contracts проверены DI без services. Общие telemetry, extension/VSIX installation, Tasks/auth/GitHub/Git/SSH не менялись.

Независимо от command/registry/editor/form cleanup branches; в базе уже есть install-wizard removal. Полные typecheck/build/package/native smoke — на следующем пакете. Другие MCP UI/contracts всё ещё остаются.
