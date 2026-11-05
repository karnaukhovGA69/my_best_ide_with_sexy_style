# edit-statistics-startup-disable

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/edit-statistics-startup-disable. База: main 411cccde06e. Владелец: чат упрощения Myself IDE.

Удалён startup сбор статистики редактирования, AI attribution, наблюдение за configuration/chat entitlement/workspace и регистрация пяти настроек AI/edit statistics. EditTelemetryContribution теперь содержит только три совместимые no-op команды _aiEdits, вызываемые обычным Git. Команды остаются disposable; проверки AI-вклада всегда возвращают false. Сервисные singleton registrations IAiEditTelemetryService/IRandomService и общая extension API сохранены.

После удаления единственного runtime consumer физически удалены четыре файла editTelemetry/browser/editStats: накопление/сохранение AI статистики, chart, status bar/hover и stylesheet (950 строк), плюс единственный оставшийся visual fixture aiStats.fixture.ts (92 строки). Поиск всех импортов/экспортируемых символов в src/build/test не выявил оставшихся потребителей. Локальное storage прежней статистики не очищается и не читается новой реализацией.

Проверки: четыре browser Mocha tests passed, 0 page errors: strict DI без configuration/telemetry/chat/workspace, отсутствие пяти configuration properties, вызовы Git-команд с ресурсами и восстановление прежних registrations при dispose. Узкий TypeScript трёх новых/изменённых файлов — 0 diagnostics, ESLint этих файлов прошёл; после физического удаления UI повторный bundle/test и scoped typecheck также прошли. git diff --check чистый. Четыре теста со старыми production contribution-файлами 411cccde06e дали четыре ожидаемых failures до удаления orphan UI, без page errors.

Дополнительный wiring не нужен. Готовая editor-telemetry-forwarding-disable меняет другой сервис и старый test: её можно объединять независимо. Внутренние helper-алгоритмы и AiEditTelemetryServiceImpl остаются и не объявляются удалёнными. Полные build/package/native отложены до общего пакета; текущий binary snapshot интегратора не расширялся.
