# local-model-flow-analytics-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/local-model-flow-analytics-disable. База: fcee67ec4848d7af8d133da30308d5c8c6c3ec0c.

P02/A07: удалить localModel.flow analytics. Область: src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/localModelSetupFlow.ts — logLocalModelFlow и private event/classification types; test/browser/agentSessions/localModelSetupFlow.test.ts — добавить regression; test/browser/widget/input/modelPicker/modelPickerLocalModelItems.test.ts — flow ожидание единственного consent test; этот отчёт. Consent/dialogs/install/remove/formatting не менять. Зависимость local-model-ready-offer-disable. GitHub authorization/shared entrypoints исключены.

Код: `091394f3958`. logLocalModelFlow не читает payload/telemetry service; private schemas удалены. Consent/install/remove/dialogs и их проверки сохранены; у consent test изменено только flow expectation. Dependency local-model-ready-offer-disable объединена без конфликтов.

Проверки: 32 browser tests в 3 suites (включая 1 повторный dependency test); ESLint 3 файлов; selected-file semantic types 3 файлов (0 diagnostics); git diff --check — passed. Общий build/typecheck/package — интегратор. Объединить ветку с её зависимостью.
