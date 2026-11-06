# agent-plugin-marketplace-views-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-plugin-marketplace-views-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить Agent Plugins installed/marketplace views и их browse/refresh actions, включая list renderer/query/update implementation. Область: chat/browser/agentPluginsView.ts; chat/test/browser/agentPluginsView.test.ts; этот отчёт. Exported AgentPluginsListView/AgentPluginsBrowseCommand имеют только локальные consumers и тест. Сохранить inert contribution ID, обычные Extensions/VSIX и данные plugins. Общие entrypoints/auth/catalog GitHub не менять.
