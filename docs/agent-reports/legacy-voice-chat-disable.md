# legacy-voice-chat-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторно не назначать. Владелец: агент ранее voice-playback-disable. Ветка: `agent/legacy-voice-chat-disable`. База: `59f0fde52ec` (main). Claim до реализации: `b682b56384c`; код и тесты: `88fe7140adb`.

## Область и результат

Задание A06/A02. До правок зарезервированы и отмечены в общем checkout: `src/vs/workbench/contrib/chat/common/voiceChatService.ts`, `src/vs/workbench/contrib/chat/test/common/voiceChatService.test.ts`, `src/vs/workbench/contrib/chat/electron-browser/actions/voiceChatActions.ts`, `src/vs/workbench/contrib/chat/test/electron-browser/actions/voiceChatActions.test.ts` и этот отчёт. Патч независим от предыдущих voice/dictation/playback задач; их ветки сохранены.

Из VoiceChatService удалены SpeechService/ChatAgentService/context DI dependencies, запуск распознавания речи, создание phrase map, преобразование agent/slash-префиксов, обработка transcription events, счётчик активных сессий и связанные подписки. Сохранены interface/DTO/decorator, имя класса и VoiceChatInProgress с false default. Создание сессии всегда отклоняется локализованной ошибкой до чтения token/options/model, в том числе при cancellation или usesAgents=false. Общий SpeechService и extension speech API не изменены.

## Вызывающий код

Единственный production-caller createVoiceChatSession находится в VoiceChatSessions.start в electron-browser/actions. До патча rejected Promise оставлял controller в GettingReady, current session и подписки accept/hide активными. Теперь catch вызывает stop с ID и context именно неудачного запуска, освобождает token/listeners, очищает placeholder, ставит Stopped и повторно выбрасывает исходную ошибку. Проверка session ID сохраняет более новую сессию при позднем отказе старой. Text input не изменяется и не отправляется.

VoiceChatSessions экспортирован для прямой проверки настоящего caller; runtime регистраций/запусков это не добавляет. Статический singleton pattern и остальные действия/синтез речи не переписывались. `chat.shared.contribution.ts` продолжает delayed-регистрацию VoiceChatService; дополнительное wiring не требуется. Shared entrypoints и настройки не менялись.

## Проверки

- `git diff --check`, область diff и обязательные базовые ancestry checks — успешно.
- Целевой ESLint четырёх изменённых TS-файлов — успешно.
- Целевая TypeScript syntactic/semantic проверка этих четырёх файлов: **0 diagnostics**, без emit/full-project diagnostics; repository options/ambient declarations и node types для изолированного тестового harness.
- `test/common/voiceChatService.test.ts` + `test/electron-browser/actions/voiceChatActions.test.ts`: **8 tests, 8 passed**, включая disposables. Четыре проверки недоступного сервиса, три проверки caller cleanup/race и прежний parseNextChatResponseChunk test.
- Проверены strict пустой DI, отказ для agent-aware/inline/cancelled запросов, отсутствие чтения token/options/model, повторные запросы и dispose. У настоящего caller проверены два последовательных отказа с сохранением draft, отсутствие accept/hide listeners, отмена token при синхронной ошибке, rethrow исходной ошибки и поздний отказ старой сессии при новой активной.
- Browser запуск: целевой esbuild bundle реальных модулей, Mocha/repository assert shim, headless Chromium; CSS/static assets исключены. Controller и внешние сервисы тестовые; production VoiceChatSessions/VoiceChatService настоящие. Несмотря на расположение suite в electron-browser, это не Electron/native/package smoke.
- Контроль чувствительности: через esbuild loader подставлен прежний voiceChatActions из main (добавлен только export для доступа теста), без изменения checkout. Две cleanup-регрессии ожидаемо упали: старый controller остался в GettingReady, listeners активны, token не отменён; остальные шесть тестов прошли. Последняя реализация прошла все восемь.

Зависимости переиспользованы из собственного рабочего каталога. Package/lockfiles не менялись. Launcher pnpm 11.25.0 при закреплённом 12.16.0 — известное ограничение среды. Полный typecheck, production bundle/package, подпись, native smoke и релиз не запускались по правилу пакетных сборок.

## Интегратору

Перенести `agent/legacy-voice-chat-disable` либо `88fe7140adb` вместе с отчётом. Не отделять изменение caller от недоступного сервиса: cleanup нужен при его штатном отказе. Сохранить существующую delayed DI registration и публичные контракты.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/common/voiceChatService.test.js` и `vs/workbench/contrib/chat/test/electron-browser/actions/voiceChatActions.test.js`. Общие typecheck/DI/startup и native smoke включить в пакет; проверить отсутствие застрявшего mic/loading состояния и сохранность ввода при невозможности запуска legacy voice chat.

Границы: ChatSynthesizerSessions/read-aloud/keyword activation source, голосовые action classes и theme participant в том же файле, отдельный voiceClient/controller, общий SpeechService/API и другие AI-пути остаются. Не заявляется полное удаление голоса/AI, всех команд, сети или микрофона по другим путям. MCP, documents/PDF, Terminal/Tasks, глобальный auth, пользовательские файлы/настройки и build/dependencies не менялись. В main ещё не объединено, нового бинарного релиза нет.
