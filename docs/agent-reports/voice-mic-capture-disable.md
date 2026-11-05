# voice-mic-capture-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее voice-tts-playback-disable. Ветка: `agent/voice-mic-capture-disable`. База: `81efa000a9f` (актуальный main). Claim: `b2a500cf212`. Реализация и тесты: `e95e2fbc383`.

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/micCaptureService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/micCaptureService.test.ts` и этот отчёт. Другие агенты эти файлы не занимали; TTS patch сохранён отдельно.

## Результат

A06: удалены getUserMedia, AudioContext/AudioWorklet/MediaStreamSource/Analyser, захват/конвертация/выдача PCM, hardware mute listeners, drain/diagnostic timers, хранение turn/window/stream state, storage/notification/log dependencies. Общий PCM worklet файл не изменён.

MicCaptureService сохранён как явно неактивный compatibility adapter с прежними interface/decorator/delayed singleton. prepare/release/abort/suppression/mute control не выполняют действий; isCapturing false, analyser/mediaStream undefined, events Event.None. startCapture и pttDown (обычный и passive) возвращают rejected Promise с локализованной причиной «Voice microphone capture is unavailable in Myself IDE.». Отказ отличается от NotAllowedError и не побуждает пользователя повторно выдавать разрешение микрофона. isMuted остаётся false, запись в свойство бездействует.

Сохранены exported getMediaCaptureWindow, isMicrophonePermissionDeniedError и MIC_CAPTURE_CHUNK_SIZE. Protected test hook getMediaCaptureWindow и неэкспортируемая конвертация PCM удалены вместе с capture runtime; единственные subclass consumers были внутри заменённого тестового файла. Прежний тест размера chunk сохранён, два obsolete positive capture tests заменены проверками отказа. Новых callers/wiring нет; оставшиеся UI consumers читают analyserNode, а controller/transport уже отключены в main.

## Проверки

- Browser Mocha: **10 tests, 10 passed**, disposable tracking включён: 7 проверок недоступности, сохранённый chunk-size test и 2 проверки экспортируемых helpers.
- Strict DI без storage/notifications/logging. Direct/concurrent/repeated capture и PTT до/после prepare отклоняются без чтения window. Passive и explicit PTT не активируют захват.
- Sinon guards: 0 getUserMedia/AudioContext/AudioWorkletNode calls; fake timers — 0 после продвижения на 120 секунд. Guards блокируют настоящее получение устройства даже при регрессии.
- Mute/suppression/release/abort не испускают start/audio/end/diagnostic events; повторный dispose и вызовы после него остаются неактивными.
- Targeted ESLint двух файлов — passed. Targeted TypeScript syntactic/semantic diagnostics двух файлов с ambient declarations — 0 diagnostics. git diff --check — passed.
- Контроль чувствительности через esbuild loader со старым runtime из базы: strict DI test ожидаемо падает на зависимости storageService; 3 helper tests проходят. Acquisition tests в этом контрольном запуске отфильтрованы, реальный микрофон не запрашивался.

Runner — отдельный esbuild bundle и headless Chromium из установленного Playwright, scratch вне репозитория. Это не официальный Electron runner, не full-project typecheck и не native smoke. Корневые dependency inputs не менялись; собственные node_modules переиспользованы. Локальный pnpm предупреждает о неизвестном workspace setting skills; зависимости не обновлялись.

## Интегратору

Перенести `e95e2fbc383` и отчёт с ветки в следующий пакет. Патч независим от `716f3ff022e` (voice-tts-playback-disable); оба дополняют уже включённую в 0.0.8 очистку voice controller/transport. Дополнительного wiring не нужно. На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/voiceClient/micCaptureService.test.js`; общие DI/startup/typecheck/native smoke — на накопленном пакете, без отдельного релиза на эту задачу.

Остаются voice UI/actions/window services, transcript store, общий speech/accessibility API, shared PCM worklet и другие AI/voice исходники. Этот патч отключает только IMicCaptureService; не заявляется запрет микрофона для любых других функций/расширений или полное удаление AI. Пользовательские разрешения/настройки/история и системные устройства не менялись. MCP, documents/PDF, Terminal/Tasks, auth, entrypoints, build/dependencies и main не изменены; новой сборки/релиза нет.
