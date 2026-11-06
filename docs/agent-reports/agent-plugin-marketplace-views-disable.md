# agent-plugin-marketplace-views-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-marketplace-views-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить Agent Plugins installed/marketplace views и их browse/refresh actions, включая list renderer/query/update implementation. Область: chat/browser/agentPluginsView.ts; chat/test/browser/agentPluginsView.test.ts; этот отчёт. Exported AgentPluginsListView/AgentPluginsBrowseCommand имеют только локальные consumers и тест. Сохранить inert contribution ID, обычные Extensions/VSIX и данные plugins. Общие entrypoints/auth/catalog GitHub не менять.

Удалены installed/marketplace view registration, plugin list rendering/querying/update/dropdown, browse/refresh actions и связанные service dependencies. Exported list/browse classes удалены после проверки consumers; совместимый contribution ID оставлен инертным. Код: 4d9a37ff245.

Проверки: 1 browser test — strict DI и отсутствие browse/refresh commands; ESLint — 2 файла; узкие TypeScript diagnostics — 2 файла, 0 ошибок; git diff --check; src search не нашёл orphan class consumers. Обычный Extensions/VSIX не менялся. Полные build/package/native smoke не запускались.
