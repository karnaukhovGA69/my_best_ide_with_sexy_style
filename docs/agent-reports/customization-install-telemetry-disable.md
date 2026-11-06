# customization-install-telemetry-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/customization-install-telemetry-disable. База: 354801b3e948558ea0ed45a9ba1ce55576ea694c.

P02/A07: убрать timing/outcome analytics wrapper. Область: src/vs/workbench/contrib/chat/common/customizationMarketplaceInstallTelemetry.ts и test/common/customizationMarketplaceInstallTelemetry.test.ts относительно contrib/chat; этот отчёт. Сохранить выполнение operation и ошибки, pure categorization helpers. Не менять installation/authentication/общие APIs/shared entrypoints.

Код: `92a9909e3ab`. Удалены stopwatch/outcome classification и event emission. Wrapper выполняет operation один раз, возвращает исходную ошибку, не интерпретирует cancellation. Mapping helpers сохранены. 2 browser tests passed; lint 2 files passed; targeted types 2 files 0 diagnostics; diff --check passed. Full проверки интегратором.
