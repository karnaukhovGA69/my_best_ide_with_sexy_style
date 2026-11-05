# editor-telemetry-forwarding-disable

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/editor-telemetry-forwarding-disable. База: main 411cccde06e. Владелец: чат упрощения Myself IDE.

DataChannelForwardingTelemetryService заменён совместимым отключённым фасадом: нет DI-зависимостей, перехватчика, отправки editTelemetry, чтения идентификаторов или проброса experiment/common properties. Методы сохраняют типы ITelemetryService, уровень NONE, error telemetry false, идентификаторы пустые. Сохранены markers/helpers используемые существующими потребителями. Удалены непотребляемые InterceptingTelemetryService и IEditTelemetryData; поиск потребителей проверен по src. Общий IDataChannelService, отправка данных расширениями и extension API не менялись.

Добавлены пять проверок: создание при strict DI без служб; отсутствие отправки при включённой подставной телеметрии и marker undefined/false/true; отсутствие идентификаторов базового сервиса. Существующий editTelemetry.test.ts обновлён под отказ от отправки AI events: metadata сценарий проверяет пустой результат, а из старого snapshot удалены только две отменённые codeSuggested записи, прочие проверки внутренних helper-алгоритмов сохранены.

Проверки: 7 browser Mocha tests passed, 0 page errors. Узкий TypeScript по 8 файлам (новый сервис/тест, прежний тест и пять потребителей) — 0 diagnostics. ESLint трёх изменённых TS файлов и git diff --check прошли. Пять новых тестов с прежним production-файлом 411cccde06e дали ровно пять ожидаемых failures, подтверждая обнаружение прежней пересылки/DI/идентификаторов; рабочий файл для baseline не заменялся.

Подключение не требуется, потребители уже импортируют этот модуль. Изменение не означает полного удаления аналитических расчётов и всех AI-исходников: editTelemetryContribution, внутренние трекеры и сторонние extension network API остаются отдельными областями. Полный build/package/native не запускался; ближайший собираемый snapshot закрыт, задача предназначена следующему пакету.
