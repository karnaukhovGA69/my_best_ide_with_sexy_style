# agent-plugin-background-updates-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-background-updates-disable. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить автоматическое обновление AI plugins и периодическую фоновую проверку repositories. Область: chat/browser/pluginAutoUpdate.ts; chat/test/browser/plugins/pluginAutoUpdate.test.ts; chat/common/plugins/pluginMarketplaceService.ts — только periodic update scheduler/idle/metered triggers, их fields/imports/DI и rescheduling из clearUpdatesAvailable; chat/test/common/plugins/pluginMarketplaceService.test.ts — periodic-update tests и imports; этот отчёт. Manual query/clone/auth, metadata hydration, обычные Git/Extensions/VSIX/Trust и shared entrypoints не менять. Hydration network path выявлен отдельно и требует следующего среза.

Реализация: a5381c3a02b. Автоустановка обновлений удалена; idle/periodic/metered/policy scheduler удалён. Ручной каталог и hydration не менялись.

Проверки: 2 целевых browser tests без page errors; lint и выбранная диагностика TypeScript четырёх файлов прошли; diff --check прошёл. Полный browser-набор: 142 assertions passed, 19 platform skips, но обнаружены асинхронные Canceled/Throttler is disposed в локальном installed store. Контрольный запуск исходных source/test из HEAD до правки: 145 passes, 19 skips, 1 failure в cancellation test и 21 page error тех же видов. Полный набор не объявляется чистым; отдельное исправление lifecycle будет следующим заданием. Общая сборка и native smoke — интегратор.
