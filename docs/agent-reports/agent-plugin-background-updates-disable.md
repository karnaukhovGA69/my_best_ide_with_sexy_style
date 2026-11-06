# agent-plugin-background-updates-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-plugin-background-updates-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить автоматическое обновление AI plugins и периодическую фоновую проверку repositories. Область: chat/browser/pluginAutoUpdate.ts; chat/test/browser/plugins/pluginAutoUpdate.test.ts; chat/common/plugins/pluginMarketplaceService.ts — только periodic update scheduler/idle/metered triggers, их fields/imports/DI и rescheduling из clearUpdatesAvailable; chat/test/common/plugins/pluginMarketplaceService.test.ts — periodic-update tests и imports; этот отчёт. Manual query/clone/auth, metadata hydration, обычные Git/Extensions/VSIX/Trust и shared entrypoints не менять. Hydration network path выявлен отдельно и требует следующего среза.
