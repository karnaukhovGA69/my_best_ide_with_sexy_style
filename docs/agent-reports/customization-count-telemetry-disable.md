# customization-count-telemetry-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/customization-count-telemetry-disable. База: 354801b3e948558ea0ed45a9ba1ce55576ea694c.

P02/A07: удалить customization counters и session observation. Область: src/vs/workbench/contrib/chat/browser/aiCustomization/customizationsTelemetryService.ts и test/browser/aiCustomization/customizationsTelemetryService.test.ts относительно contrib/chat; этот отчёт. Сохранить service/contribution contracts. Shared entrypoints/GitHub authorization/настройки пользователя исключены.

Код: `926fe2e80ce`. Удалены session/request observers, async provider queries, source classification/counts и telemetry. Service/contribution инертны без DI. 2 browser tests passed; ESLint 2 files passed; targeted TypeScript 2 files 0 diagnostics; diff --check passed. Full package/typecheck интегратором. Пользовательские customizations не менялись, wiring не требуется.
