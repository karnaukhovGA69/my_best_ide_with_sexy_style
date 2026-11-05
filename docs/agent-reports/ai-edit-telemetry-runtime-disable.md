# ai-edit-telemetry-runtime-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/ai-edit-telemetry-runtime-disable. База: актуальный main 411cccde06e плюс необходимая готовая dependency agent/editor-telemetry-forwarding-disable (663370182ad); эта ветка содержит её историю и обновлённый контракт старого теста.

Область: editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryServiceImpl.ts; новый test/browser/aiEditTelemetryService.test.ts и существующий editTelemetry.test.ts в той же contrib; этот отчёт. Удалить построение/классификации/отправку AI edit events, сохранить IAiEditTelemetryService и выдачу непрозрачного уникального suggestion ID для extension API. Событийные payload не читать/хранить. Старый helper snapshot нормализовать по случайным UUID, поскольку удалённый генератор analytics event IDs не должен влиять на тестовые ожидания. Другие трекеры, root wiring/build/deps и startup область отдельной готовой ветки не менять.
