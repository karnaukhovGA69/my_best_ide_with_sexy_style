# agent-plugin-hydration-local-only

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-hydration-local-only. База: bb3be5635574e9a356eda9c7eb6a7b9bb45bc492.

Область: chat/common/plugins/pluginMarketplaceService.ts — hydration и чтение persisted metadata cache; chat/test/common/plugins/pluginMarketplaceService.test.ts — regression tests; этот отчёт. Убрать автоматическую HTTP/clone загрузку metadata после запуска, сохранить локальные данные. Ручные query/install/auth и TTL ручного refresh не менять. Зависимости: agent-plugin-background-updates-disable и agent-plugin-store-disposal-fix для совместной проверки.

Реализация: c236051c123. Hydration использует persisted v2 metadata, включая stale descriptor, либо уже локальный repository/manifest; HTTP/clone из этого пути исключены. TTL явного fetch сохранён. Зависимости включены merge: 34c3b9b9a08 (background updates) и 850446a3140 (store disposal).

Проверки совместного набора: 196 passes, 19 platform skips, 0 failures и 0 page errors (marketplace + installed store + auto updater). Новые regression: fresh/expired cache, local repository без HTTP/clone, сохранение TTL явного fetch; standalone recovery также проверяет отсутствие сети. Lint и выбранные TS diagnostics двух файлов, diff --check — без ошибок. После финального runtime-эквивалентного исправления assert length вместо deepStrictEqual повторены lint/types; общий browser run перед ним прошёл. Общая сборка/native smoke — интегратор.
