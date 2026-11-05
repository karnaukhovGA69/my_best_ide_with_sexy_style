# mcp-install-actions-runtime-remove

Статус: ЗАНЯТО. Владелец: MCP cleanup. Ветка: `agent/mcp-install-actions-runtime-remove`. База main `411cccde06e`. Следующий пакет после release-0.0.9.

Зарезервированы src/vs/workbench/contrib/mcp/browser/mcpServerActions.ts (InstallAction, InstallInWorkspaceAction, InstallInRemoteAction, их private helpers/imports), common/mcpTypesUtils.ts (только осиротевший startServerByFilter и imports), test/browser/mcpConfigurationEntryPoints.test.ts (install/start-filter tests и imports) и этот отчёт. Удалить local/workspace/remote installation UI runtime, telemetry calls, config target picker и post-install startup. Сохранить action identities/constants, always disabled/hidden и явный unavailable run; остальные server actions/manual source editing не менять. Общие extension/VSIX installation, telemetry/Tasks/auth/GitHub/Git/SSH APIs и чужие области исключены.
