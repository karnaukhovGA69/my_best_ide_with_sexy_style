# editor-telemetry-forwarding-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/editor-telemetry-forwarding-disable. База: main 411cccde06e.

Область: src/vs/platform/dataChannel/browser/forwardingTelemetryService.ts, новый test/browser/forwardingTelemetryService.test.ts внутри dataChannel и этот отчёт. Удалить пересылку editor telemetry в канал editTelemetry, сохранив типы/форму сервисного фасада и используемые markers. Проверить strict DI без зависимостей и отсутствие обращений к telemetry/data channel даже с включёнными подставными сервисами. Общий IDataChannelService и extension API, файлы других агентов, wiring/deps/build не менять. Общая сборка остаётся интегратору, текущий бинарный snapshot не расширять.
