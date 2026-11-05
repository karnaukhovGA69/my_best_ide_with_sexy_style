# ai-edit-telemetry-runtime-disable

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/ai-edit-telemetry-runtime-disable. База: main 411cccde06e плюс готовая dependency agent/editor-telemetry-forwarding-disable 663370182ad. При merge этой ветки история dependency включается автоматически; не cherry-pick один последний коммит без предыдущего изменения контракта отправки.

AiEditTelemetryServiceImpl сокращён с 284 до 20 строк: удалены классификации, построение и отправка codeSuggested/codeAccepted/codeRejected событий, генерирование analytics event IDs, DI telemetry/data-channel/random-service. Сохранены IAiEditTelemetryService, выдача отдельного локального сериализуемого suggestion ID через существующий EditSuggestionId.newId и совместимые no-op методы accepted/rejected. Payload не читается/перебирается/сохраняется. Такие идентификаторы правок не являются идентификатором пользователя или сессии и не отправляются этим сервисом.

Новые проверки: strict DI без служб; 100 разных сериализуемых ID; запрет чтения/перечисления/изменения payload через throwing Proxy. Старый helper snapshot editTelemetry.test.ts сравнивает timing/statistics с нормализацией случайных UUID: прежнее потребление random sequence для analytics event IDs больше не часть контракта. Предыдущий тест отказа от отправки Agent Host metadata сохранён.

Проверки: 10 browser Mocha tests passed (3 новых, 5 forwarding, 2 существующих consumer/helper), 0 page errors. Узкий TypeScript пяти файлов, включая mainThreadLanguageFeatures и singleton contribution: 0 diagnostics. ESLint трёх изменённых TS файлов и git diff --check прошли. Три новых теста с прежним AiEditTelemetryServiceImpl из 663370182ad дали ровно три ожидаемых failures; payload test специально снабжён старой random dependency и обнаруживает именно попытку чтения payload.

Wiring не требуется. edit-statistics-startup-disable меняет другую область и интегрируется независимо. Внутренние edit tracking helpers и общий extension API не удалялись, полное удаление AI не заявляется. Полные build/package/native остаются интегратору на следующем пакете.
