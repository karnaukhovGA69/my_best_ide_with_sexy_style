# voice-client-transport-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее voice-tool-dispatch-disable. Ветка: `agent/voice-client-transport-disable`. База: `59f0fde52ec` (main). Claim: `e1fc84f546e`. Реализация и тесты: `4d8861d220b`.

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceClientService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceClientService.test.ts` и этот отчёт. Область не пересекается с текущими MCP/documents задачами и предыдущими собственными voice patches.

## Результат

A06: удалены WebSocket/WebRTC transport, SDP/provider availability запросы, создание remote audio/stream, ping/pong/reconnect/grace timers, обработка входящих сообщений, маршрутизация GPT-Live delegation, сериализация/отправка аудио, диагностики, контекста, истории, machine ID, tool results, narration и HTTP feedback. Удалены зависимости DI на config/log/product/mic/speech/TTS и подписка на изменение настроек. Удалены локальные WebRTC test-only types и protected transport test hooks: поиск по src показал только потребителей внутри заменённого suite.

Сохранены общий IVoiceClientService, decorator и delayed singleton registration; runtime class теперь явно неактивный compatibility adapter. State всегда disconnected, availability false, narration возвращает undefined, outbound методы не читают/сохраняют payload, submitFeedback возвращает `{ ok: false, error }` без запроса.

connect сохраняет существующий событийный контракт startup failure: onError, затем onFatalDisconnect с code 0, kind fatal и локализованной причиной недоступности. Promise завершается, но успешное соединение/сессия не объявляются. Это позволяет существующему контроллеру сбросить connecting state и освободить свои audio/mic ресурсы. Флаг clientSide намеренно не указан: контроллер интерпретирует его исключительно как отсутствие backend URL и иначе скрывает истинную причину. Retry UI в контроллере остаётся; повторная попытка получает тот же отказ без сети.

Сохранены pure resolveAutomaticVoiceLanguage и два прежних теста language resolution/normalizeAgentsVoiceId. Остальные прежние тесты работающего транспорта заменены проверками недоступности. Common контракты и voiceSessionController не изменены.

## Проверки

- Browser Mocha: **10 tests, 10 passed** — 7 новых проверок недоступности, 2 сохранённых helper tests, 1 существующий controller test `falls back to the server reason for a code this build does not know`.
- Проверены strict DI без зависимостей, отсутствие config listeners при включённых settings, повторный connect и последовательность error/fatal, disconnected state во время уведомлений, reentrant disconnect, освобождение listeners при dispose.
- С Sinon guards: fetch, WebSocket, RTCPeerConnection и Audio не вызываются. Fake timers: 0 таймеров до/после продвижения на 120 секунд. Это целевой unit test сервиса, не сетевой аудит всего приложения.
- Outbound методы вызваны повторно с Proxy payloads, которые бросают при чтении: audio/context/diagnostic/tool/narration/session calls не читают данные, не создают таймеров и не испускают рабочие inbound events. Feedback с таким payload возвращает отказ.
- Targeted ESLint двух изменённых файлов — passed. TypeScript syntactic/semantic diagnostics двух файлов с ambient declarations — 0 diagnostics. `git diff --check` — passed.

Тесты выполнены отдельным esbuild bundle и headless Chromium из уже установленного Playwright; CSS/assets stubbed; scratch вне репозитория. Это не официальный Electron runner/native smoke и не полный typecheck. Переиспользованы собственные node_modules; зависимости не обновлялись. Установленный pnpm 11.25.0 отличается от packageManager 12.16.0 и предупреждает о workspace setting skills.

## Интегратору

Перенести `4d8861d220b` и отчёт с ветки. Wiring не нужен: singleton registration сохранена. Изменения независимы от предыдущих voice live/dictation/transcription/playback/legacy/keyword/dispatch веток. На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/voiceClient/voiceClientService.test.js`; включить controller startup/fatal handling и общие DI/typecheck/native smoke в единый релизный пакет.

Оставшаяся область: voiceSessionController до вызова transport выполняет собственные auth/entitlement/transcript/audio preparation, а также содержит telemetry, прямую отправку send_to_chat и UI/actions. MicCaptureService, TtsPlaybackService, transcript storage, общие speech API и другие voice реализации остаются. Этот патч прекращает транспортные действия только VoiceClientService; он не доказывает отсутствие сети/микрофона или полное удаление голоса/AI во всём приложении. Контроллер можно отключить отдельной задачей.

MCP, documents/PDF, Terminal/Tasks, пользовательские настройки/история, auth implementation, общие entrypoints и build/dependencies не менялись. В main ещё не интегрировано; полной сборки, упаковки и нового бинарного релиза нет.
