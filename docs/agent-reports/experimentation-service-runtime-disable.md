# experimentation-service-runtime-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/experimentation-service-runtime-disable. База: main 411cccde06e.

Область: src/vs/workbench/services/assignment/common/assignmentService.ts и соответствующий test/common/assignmentService.test.ts, этот отчёт. Заменить WorkbenchAssignmentService отключённым совместимым сервисом; удалить TAS runtime/network/storage/telemetry/filter/override-delay и пользовательский enableExperiments schema. Сохранить service identifier, interfaces, singleton registration, методы запросов и Event.None. Удалить локальные helper exports, которые были экспортированы только для тестов старого TAS pipeline, и заменить старые endpoint tests на проверки недоступности экспериментов. Общие platform assignment API, отдельные assignmentFilters/contextFilter и их тесты, root deps/build/wiring не менять. SDK dependency root остаётся интегратору после полного аудита других потребителей.
