# customization-migration-analytics-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/customization-migration-analytics-disable. База: f9f821d47f632bfd5afca144685208f5f99e42c2.

P02: убрать hint/action/outcome analytics миграций. Область: src/vs/workbench/contrib/chat/common/promptSyntax/service/customizationMigrationTelemetryService.ts и test/common/promptSyntax/service/customizationMigrationTelemetryService.test.ts относительно contrib/chat; этот отчёт. Сохранить operational migration lifecycle, result validation, retry/cleanup и constructor compatibility. GitHub authorization/shared entrypoints/реальные миграции не менять.

Код: `be5da5d0dc3`. Analytics methods инертны, payload/classification/reduction/emission удалены. Operational result parser, inventory validation, lifecycle statuses/retry и recovery logging сохранены. 6 browser tests passed; lint 2 files passed; targeted types 2 files 0 diagnostics; diff --check passed. Full проверки интегратором; wiring не требуется.
