# chat-dictation-service-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторно не назначать. Владелец: агент ранее voice-transcription-transport-disable. Ветка: `agent/chat-dictation-service-disable`. База: `59f0fde52ec` (main). Claim: `656bb582d74`; реализация и тесты: `e9828bef9b9`.

## Область и результат

Задание A06/P01. До реализации область закреплена в этом отчёте; копия сразу оставлена в общем checkout. Изменены только `src/vs/workbench/contrib/chat/browser/speechToText/chatSpeechToTextService.ts`, `src/vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.ts` и этот отчёт. Отдельная task-ветка от main; предыдущие ветки voice-live-session-disable и voice-transcription-transport-disable сохранены, этот патч от них не зависит.

ChatSpeechToTextService заменён совместимым неактивным сервисом без constructor DI dependencies. Удалены запросы микрофона, audio/PCM capture, обращения к GitHub sessions/token, auth/config/entitlement listeners, local/cloud model startup, скачивание/подготовка моделей, LLM cleanup, session/accuracy/model telemetry и их вычисление, timers и накопление транскриптов. Это удаление реализации, а не дополнительный флаг или скрытие кнопки.

`state` всегда Idle; configured/busy/preparing/downloading/showTranscript — false; analyser/progress — undefined; backend — unavailable. События Event.None. `start` для chat/editor/terminal отклоняется локализованной ошибкой до чтения Window. `switchMicrophone` и `stopAndTranscribe` возвращают undefined, cancel безопасно завершается. Accuracy method не читает входные данные и ничего не рассчитывает/не отправляет. После dispose сервис не становится доступным.

## Совместимость

Сохранены все 19 экспортируемых имён, service decorator, интерфейсы и типы, enum/settings/command IDs. Сохранены чистые compatibility helpers выбора текста/backend/entitlement и построения cleanup prompt; они больше не запускают обработку через этот сервис. Полное удаление всех вспомогательных AI-исходников не заявляется.

Внешние consumers проверены: Chat input/actions/voice input mode, editor dictation, terminal voice, dictation session/download UI, fixtures. Production использует IChatSpeechToTextService; код, зависящий от удалённых private methods/prototype, находился в заменённых тестах. Сохраняемый `isDictationActiveOnSurface` возвращает false для неактивного сервиса.

Общие `chat.shared.contribution.ts` singleton registration и init contribution остаются. Их инъекция теперь создаёт неактивный класс без дополнительных сервисов. RawContextKey defaults recording/configured/preparing/usesMai — false; новая реализация их не поднимает и не слушает изменения настроек. Дополнительное wiring не требуется.

## Проверки

- `git diff --check`, область diff и базовые ancestry checks — успешно.
- Целевой ESLint двух изменённых TS-файлов — успешно; после правок теста повторён только его lint.
- Целевая TypeScript-проверка syntactic/semantic diagnostics двух изменённых файлов: **0 diagnostics**, без emit и full-project diagnostics. Использованы repository compilerOptions и ambient declarations; в изолированном harness явно добавлен node ambient type для assert. Выявленная лишняя аргументация isDictating в новом тесте исправлена до итоговой проверки.
- Browser suites: `chatSpeechToTextService.test.ts`, `dictationSession.test.ts`, `dictationDownloadRing.test.ts`, `voiceInputMode.test.ts` — **37 tests, 37 passed**. В составе 9 новых регрессий, 10 сохранённых тестов чистых helpers и 18 существующих тестов consumers. Целевой esbuild bundle реальных модулей, Mocha/repository assert shim в headless Chromium, CSS/static assets исключены; это не штатный Electron runner и не packaged native smoke.
- Новые регрессии: создание через strict пустой DI, idle state, отказ start на всех трёх поверхностях без чтения Window, безопасные microphone switch/cancel/stop, отсутствие чтения accuracy data, событий и работы после dispose. Реальный `startDictation` + test code editor после отказа закрывает активную сессию и сохраняет текст.
- Проверка чувствительности с исходной реализацией main через esbuild loader (без изменения checkout): 9 новых тестов ожидаемо падают на старых constructor dependencies/инициализации, 28 остальных проходят. Итоговая новая реализация прошла все 37.
- Статическая сверка AST с main подтвердила сохранение 19 экспортируемых имён.

Зависимости переиспользованы из собственного рабочего каталога. Новых пакетов нет, manifests/lockfiles не менялись. Launcher pnpm 11.25.0 при закреплённом 12.16.0 — известное ограничение окружения. Полный client typecheck, production bundle/package, подпись, native smoke и релиз не запускались по правилу пакетных сборок.

## Интегратору

Перенести `agent/chat-dictation-service-disable` либо `e9828bef9b9` вместе с отчётом. Патч не пересекается по файлам с предыдущими voice transport/live-session и терминальной очисткой, MCP, documents/PDF. При объединении voice-transcription-transport-disable прежние 28 тестов consumer заменены актуальной suite этого патча; использовать текущие файлы, не возвращать тесты удалённых private methods.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/chatSpeechToTextService.test.js` и три consumer suites выше. Общий typecheck/DI/startup/native smoke провести в составе накопленного пакета. Проверить сохранность ввода текста в редакторе/терминале, отсутствие mic/model-download prompt при попытке встроенной диктовки и обычный startup.

Общий SpeechService и речевой extension API, microphone UI/actions, отдельные VoiceClient/VoiceChat services, platform local transcription, общий auth и retained helpers остаются. Этот патч устраняет обращения к микрофону/аккаунту/моделям именно из ChatSpeechToTextService; это не утверждение отсутствия всех voice/AI/network paths. Пользовательские настройки, история и файлы не менялись. В main ещё не объединено, нового бинарного релиза нет.
