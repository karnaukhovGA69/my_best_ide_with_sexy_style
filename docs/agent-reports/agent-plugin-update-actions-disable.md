# agent-plugin-update-actions-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-update-actions-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить AgentPluginCommandsContribution update/force update actions и единственный UI caller в AI customization plugin list. Область: chat/browser/agentPluginCommands.ts; chat/browser/aiCustomization/pluginListWidget.ts — только update-button renderer/call/handler, unused import и ставший неиспользуемым workspaceService DI parameter; chat/test/browser/agentPluginCommands.test.ts (новый); этот отчёт. Обычные Extensions/VSIX/manual extension update, plugin data, общие entrypoints/auth не менять. Existing pluginListWidget.test.ts запустить без правок.

Удалены update/force-update registration/handlers, кнопка обновления AI plugins и единственный её caller, больше не используемый workspace DI. Shared command constants сохранены в общем файле; production consumers больше нет. Код: 2dcc5106e67.

Проверки: 16 browser tests passed (15 существующих plugin list tests и strict DI/отсутствие update commands); ESLint — 3 файла; узкие TypeScript diagnostics — 3 файла, 0 ошибок; git diff --check. Первый typecheck выявил unused workspace service после удаления кнопки: исправлено, types/lint прошли повторно. Обычные Extensions/VSIX и данные не менялись. Full build/package/native smoke не запускались.
