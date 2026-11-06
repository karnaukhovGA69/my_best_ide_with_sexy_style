# agent-plugin-hydration-local-only

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-plugin-hydration-local-only. База: bb3be5635574e9a356eda9c7eb6a7b9bb45bc492.

Область: chat/common/plugins/pluginMarketplaceService.ts — hydration и чтение persisted metadata cache; chat/test/common/plugins/pluginMarketplaceService.test.ts — regression tests; этот отчёт. Убрать автоматическую HTTP/clone загрузку metadata после запуска, сохранить локальные данные. Ручные query/install/auth и TTL ручного refresh не менять. Зависимости: agent-plugin-background-updates-disable и agent-plugin-store-disposal-fix для совместной проверки.
