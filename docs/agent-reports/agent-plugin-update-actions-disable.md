# agent-plugin-update-actions-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-plugin-update-actions-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить AgentPluginCommandsContribution update/force update actions и единственный UI caller в AI customization plugin list. Область: chat/browser/agentPluginCommands.ts; chat/browser/aiCustomization/pluginListWidget.ts — только update-button renderer/call/handler и unused import; chat/test/browser/agentPluginCommands.test.ts (новый); этот отчёт. Обычные Extensions/VSIX/manual extension update, plugin data, общие entrypoints/auth не менять. Existing pluginListWidget.test.ts запустить без правок.
