# edit-statistics-startup-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/edit-statistics-startup-disable. База: main 411cccde06e.

Область: src/vs/workbench/contrib/editTelemetry/browser/editTelemetry.contribution.ts, editTelemetryContribution.ts и новый test/browser/editStatisticsDistribution.test.ts внутри editTelemetry, этот отчёт. Удалить startup autoruns/tracking/stats/AI-coauthor и регистрацию настроек аналитики. Сохранить совместимые _aiEdits no-op команды, которые вызывает обычный Git, и DI singleton API для остающихся потребителей. Внутренние tracking algorithms/test fixtures, AiEditTelemetryServiceImpl, forwardingTelemetryService, root wiring/deps/build вне задачи. Область не пересекается с готовой editor-telemetry-forwarding-disable; обе ветки можно интегрировать независимо. Полные проверки только на пакете интегратором.
