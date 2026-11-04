# voice-playback-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторно не назначать. Владелец: агент ранее chat-dictation-service-disable. Ветка: `agent/voice-playback-disable`. База: `59f0fde52ec` (main). Claim до реализации: `8cad0af46e8`; код и тесты: `0c3d39f3a34`.

## Область и результат

Задание A06/A03. До правок резервирование записано в этот отчёт и его копию в общем checkout. Изменены только `src/vs/workbench/contrib/chat/common/voicePlaybackService.ts`, новый `src/vs/workbench/contrib/chat/test/common/voicePlaybackService.test.ts` и этот отчёт. Предыдущие task-ветки сохранены; этот патч независим от voice live sessions, dictation и transcription transport.

VoicePlaybackService больше не хранит транскрипты, timestamp, speaking session, last-played map или pending response set. Удалены command-service DI, replay cancellation state и вызовы `_chat.voicePlayback.replay` / `_chat.voicePlayback.stop`. Вместо изменяемого состояния используются штатные constObservable: speaking = undefined, обе версии = 0. Lookup возвращает undefined/false, notify/pending/stop не меняют состояние; replay завершается без действий, как при отсутствии текста.

Удалены регистрации двух bridge commands: `_chat.voicePlayback.notifyStart` и `_chat.voicePlayback.notifyEnd`, их payload parsing и связанные импорты. Сохранены service decorator, интерфейсы/класс и реальная delayed singleton registration в этом же модуле. Это удаление хранения/dispatch/регистраторов, а не скрытие меню.

## Потребители и границы

Проверены ChatViewPane (инъекция сервиса), AgentSessionRenderer (pending flag/version) и Sessions list (speaking/last-played/pending/replay/stop). Контракт read/get наблюдаемых значений сохранён. Для интерфейсов нет активной речи, сохранённого ответа или ожидающего воспроизведения. Поиск не выявил production-прямого конструирования класса с прежним constructor или обращения к его prototype; consumers используют IVoicePlaybackService.

Два других обработчика `_chat.voicePlayback.replay` и `_chat.voicePlayback.stop` всё ещё находятся в `browser/voiceClient/voiceSessionController.ts`. Этот патч прекращает их вызов через VoicePlaybackService, но не удаляет те регистрации и не блокирует другие пути. VoiceChatService, SpeechService/API, voice controller, UI/actions, общие entrypoints, MCP, documents/PDF, Terminal/Tasks, build/dependencies не менялись. Нельзя объявлять весь voice/AI удалённым или обещать отсутствие сети/микрофона в других областях.

## Проверки

- `git diff --check`, область diff и базовые ancestry checks — успешно.
- `pnpm run eslint` для двух изменённых TS-файлов — успешно.
- Целевая TypeScript syntactic/semantic проверка этих двух файлов: **0 diagnostics**, без emit или full-project diagnostics; repository compilerOptions/ambient declarations, node ambient type добавлен для изолированного test harness.
- Новый `test/common/voicePlaybackService.test.ts` вместе с существующим `test/browser/agentSessions/agentSessionsRenderer.test.ts`: **12 tests, 12 passed** (6 новых, 6 существующих), включая disposables. Реальные модули собраны целевым esbuild bundle и выполнены Mocha в headless Chromium с repository assert shim; CSS/static assets исключены. Существующие renderer tests используют собственные mocks; это не packaged native smoke.
- Новые регрессии проверяют отсутствие двух команд при загрузке модуля и сохранение delayed DI, создание сервиса через strict пустой DI, отсутствие state/transcript retention, отсутствие replay/stop dispatch, стабильный snapshot через настоящий autorun, отсутствие чтения URI и безопасный повторный dispose/cleanup.
- Контроль чувствительности через esbuild loader исходного main без изменения checkout: все 6 новых проверок ожидаемо упали (старые command registrations и constructor dependency), 6 renderer tests прошли. Последняя реализация прошла все 12.

Переиспользованы собственные зависимости рабочего каталога. Package/lockfiles не менялись. Launcher pnpm 11.25.0 при закреплённом 12.16.0 — известное ограничение окружения. Полный typecheck, bundle/package, native smoke, подпись и релиз не запускались по правилу пакетных сборок.

## Интегратору

Перенести `agent/voice-playback-disable` либо `0c3d39f3a34` с отчётом. Wiring не требуется: сохранить импорт этого модуля и delayed singleton registration для существующих consumers. Патч не пересекается по файлам с другими готовыми voice/MCP/documents задачами.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/common/voicePlaybackService.test.js` и `vs/workbench/contrib/chat/test/browser/agentSessions/agentSessionsRenderer.test.js`. В общем пакете проверить DI/startup и отсутствие двух notify-команд через command inventory; общий typecheck/native smoke остаются integration. Не возвращать commandService dependency или replay dispatch при сборке пакета.

В main ещё не объединено, нового бинарного релиза нет. Пользовательские файлы, история и настройки не менялись.
