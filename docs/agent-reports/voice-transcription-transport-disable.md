# voice-transcription-transport-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторно не назначать. Владелец: агент ранее voice-live-session-disable и ai-terminal-cleanup-refresh. Ветка: `agent/voice-transcription-transport-disable`. База: `59f0fde52ec` (main). Claim: `f8e6eaba036`, реализация и тесты: `33c8a320bc8`.

## Область и результат

Задание A06 project-plan. До правок область отмечена в этом отчёте и его копии в общем checkout. Изменены только `src/vs/workbench/contrib/chat/browser/speechToText/voiceCodeTranscriptionClient.ts`, `src/vs/workbench/contrib/chat/test/browser/speechToText/voiceCodeTranscriptionClient.test.ts` и этот отчёт. Ветка независима от предыдущих терминальной и live-session задач: они сохранены отдельно.

Реальный WebSocket transport заменён совместимым недоступным клиентом. Удалены создание сокета, обработчики socket events, сборка URL с auth token, отправка аудио/ptt frames, connection/session deadlines, ping/pong timers, разбор ответов и сохранение turn/revision state. Убраны constructor DI dependencies на config/product/log; клиент не хранит window, token или audio. Все интерфейсы/DTO, service decorator и имя класса сохранены.

`isConnected` всегда false; события — `Event.None`. `connect` и `startSession` возвращают rejected Promise с локализованной ошибкой недоступности; методы sendPttStart/AudioChunk/End синхронно бросают ту же ошибку. Текст ошибки не включает входные данные. `disconnect` и повторный dispose безопасны, фиктивные close/error/transcription события не генерируются.

## Потребители и подключения

`chat.shared.contribution.ts` уже регистрирует класс как delayed singleton: изменение wiring не нужно. Поиск по src показал, что production-потребитель — `ChatSpeechToTextService` через `IVoiceCodeTranscriptionClient`; прямое конструирование прежнего класса находилось только в заменённом тесте. Новые тесты создают клиент через TestInstantiationService.

`ChatSpeechToTextService._startMaiSession` ожидает connect → startSession → sendPttStart. Ошибка connect попадает в существующий catch вызывающего startup: teardown, уведомление и отклонение запуска. Отдельные stop/cancel/teardown paths используют disconnect. Его интерфейс сохранён.

Важное ограничение: вызывающий ChatSpeechToTextService получает микрофон до начала backend session и GitHub token до connect; его constructor также устанавливает auth/config listeners. Эти действия в текущем патче не отключены. Поэтому отсутствие отправки аудио этим транспортом не означает отсутствие запроса микрофона, авторизации, всех сетевых путей или полного удаления voice/AI. Следующая независимая область для очистки — сам ChatSpeechToTextService после аудита внешних consumers.

## Проверки

- `git diff --check`: успешно; diff ограничен назначенными файлами, обязательные базовые коммиты являются предками HEAD.
- Целевой `pnpm run eslint`: оба изменённых TS-файла успешно; после адаптации тестовых assertions повторён только изменённый тест.
- Новый `speechToText/voiceCodeTranscriptionClient.test.ts` и существующий `chatSpeechToTextService.test.ts`: **32 tests, 32 passed** (4 новых и 28 существующих). Целевой esbuild bundle реальных модулей, repository assert shim и Mocha в headless Chromium; CSS и статические ресурсы исключены из bundle. Тесты вызывающего сервиса используют его существующие mocks, это не native end-to-end dictation.
- Новые регрессии: product endpoint и loopback override не включают транспорт; переданный Window недоступен даже для чтения; session initialization отклоняется до/после connect failure; все send operations отклоняются и не включают input в ошибку; повторные disconnect/dispose/reconnect безопасны и не создают событий. Проверены disposables.
- Контроль чувствительности: те же suites собраны с исходным клиентом `59f0fde52ec` через esbuild loader без изменения checkout. Все 4 новые проверки упали, 28 существующих прошли. Контрольный отказ ожидаем; итоговая реализация прошла все 32.
- Repository browser assert shim не сравнивает rejection с object matcher и не поддерживает такой matcher в throws; тест явно проверяет тип/текст ошибки через predicate и helper. Первоначальный отказ тестового assertion исправлен, итоговые результаты выше относятся к последней версии.

Переиспользованы собственные зависимости рабочего каталога. Новых пакетов нет; root manifests/lockfiles не менялись. Launcher pnpm 11.25.0 отличается от закреплённого 12.16.0 — известное ограничение среды. Полный typecheck, production package, native smoke и релиз не запускались по правилу пакетных сборок.

## Интегратору

Перенести `agent/voice-transcription-transport-disable` либо `33c8a320bc8` вместе с отчётом. Общих подключений и изменений контракта не требуется. Независим от voice-live-session-disable, терминальной очистки, MCP и documents/PDF. Общие entrypoints, mic capture, SpeechService, extension API, auth, terminal и dependencies/build не менялись.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/speechToText/voiceCodeTranscriptionClient.test.js` и `vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.js`; общие typecheck/build/native smoke включить в накопленный пакет. Проверить запуск приложения и shared Chat DI, не выдавая этот isolated browser-run за native проверку.

В main ещё не объединено, нового бинарного релиза нет.
