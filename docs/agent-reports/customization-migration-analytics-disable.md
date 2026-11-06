# customization-migration-analytics-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/customization-migration-analytics-disable. База: f9f821d47f632bfd5afca144685208f5f99e42c2.

P02: убрать hint/action/outcome analytics миграций. Область: src/vs/workbench/contrib/chat/common/promptSyntax/service/customizationMigrationTelemetryService.ts и test/common/promptSyntax/service/customizationMigrationTelemetryService.test.ts относительно contrib/chat; этот отчёт. Сохранить operational migration lifecycle, result validation, retry/cleanup и constructor compatibility. GitHub authorization/shared entrypoints/реальные миграции не менять.
