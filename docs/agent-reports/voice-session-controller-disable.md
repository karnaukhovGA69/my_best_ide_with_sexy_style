# voice-session-controller-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее voice-client-transport-disable. Ветка: `agent/voice-session-controller-disable`. База: `59f0fde52ec` (main). Claim: `c2f58da3102`. Код и тесты: `0a6b9542497`.

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceSessionController.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceSessionController.test.ts` и этот отчёт. Чужие MCP/documents области и ранее подготовленные voice patches не затронуты.

## Результат

A06/A02: удалена runtime реализация VoiceSessionController — startup/preflight, голосовая авторизация/entitlement requests, mic/TTS, transport, чтение/запись транскриптов, telemetry, context gathering, отправка send_to_chat, auto-approvals, confirmations, session creation/navigation, narration/replay/feedback, subscriptions/autoruns/window handlers/watchdog/retry timers. Контроллер больше не запрашивает DI services. Оригинальные реализации auth, transcript storage, mic/TTS не изменены; пользовательские данные не удалялись.

Удалены регистрации `_chat.voicePlayback.replay` и `_chat.voicePlayback.stop` из конструктора. Отдельные notifyStart/End регистрации принадлежат ранее подготовленному voice-playback-disable; для полной очистки этого командного пути объединить оба патча.

IVoiceSessionController, exported types, decorator и delayed singleton registration сохранены. Контроллер теперь явно неактивный compatibility adapter: const observables сообщают `error`/«Voice Mode is unavailable in Myself IDE.», connected/connecting/reconnecting false, пустые transcript/confirmation arrays и отсутствие session target. Все управляющие методы, включая simulateConnection, бездействуют. connect возвращает завершённый Promise без запуска и без исключения — существующие UI callers наблюдают постоянное состояние недоступности, успешное подключение не объявляется. submitFeedback возвращает явный `{ ok: false, error }` без сбора данных.

Pure helpers isVoiceEntitled/isVoiceSessionActiveForInput сохранены без изменения: их используют другие UI/entrypoint файлы, не входящие в задачу. Сохранены два прежних теста input ownership; остальные тесты удалённой runtime реализации заменены девятью тестами недоступности.

## Проверки

- Browser Mocha: **11 tests, 11 passed** — 9 новых проверок и 2 прежних input ownership tests; disposable tracking включён.
- Strict DI без auth/audio/chat/storage/telemetry services. Persisted enabled/hands-free settings не создают configuration listeners.
- Повторный/параллельный connect, setActiveWindow и simulateConnection не читают Proxy window. Fake timers: 0 таймеров, в том числе после продвижения на 120 секунд.
- Push-to-talk, hands-free/mute, stop/discard, session target/navigation/new session/finish-and-submit не активируют состояние и не читают Proxy URI; нет pending confirmations/transcripts. Observer обновляется только при исходной подписке.
- Replay/stop commands отсутствуют до/после disposal. Feedback отказывает. Повторный dispose и вызовы после него остаются неактивными.
- Targeted ESLint двух файлов — passed. Targeted TypeScript syntactic/semantic diagnostics двух файлов с ambient declarations — 0 diagnostics. `git diff --check` — passed.
- Контроль чувствительности: через esbuild loader подставлен прежний runtime из main; strict DI test ожидаемо падает на обязательной зависимости voiceClientService, оба сохранённых helper tests проходят. Остальные новые тесты в этом контрольном запуске отфильтрованы; старый runtime не создавался с настоящими сервисами.

Тесты выполнены отдельным esbuild bundle и headless Chromium из уже установленного Playwright; scratch вне репозитория. Это не официальный Electron runner, не full-project typecheck и не native smoke. Переиспользованы собственные node_modules; зависимости не менялись. Установленный pnpm 11.25.0 отличается от packageManager 12.16.0 и предупреждает о workspace setting skills.

## Интегратору

Перенести `0a6b9542497` и отчёт с ветки. Дополнительного wiring нет. Патч независим от предыдущих voice transport/dispatch/live/dictation/transcription/playback/legacy/keyword задач и должен войти в общий пакет. На общем output запустить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/voiceClient/voiceSessionController.test.js`, остальные voice suites для объединённого дерева, затем общие DI/startup/typecheck/native smoke в едином релизном цикле.

После переноса прежнего voice-client-transport-disable его отчёт о выбранном controller fallback test остаётся историей проверки той ветки: этот obsolete controller test теперь удалён вместе с реализацией и заменён unavailable suite. Не восстанавливать старые tests при интеграции.

Оставшаяся область: voice UI/actions/window service, entitlement helper, mic/TTS implementations, transcript store, common speech API и прочие voice исходники остаются. Интерфейсы содержат старые описания активного API для совместимости; класс явно помечен как неактивный. Не заявляется удаление всех AI/voice исходников, всех команд или отсутствие сети/микрофона по любым другим путям.

MCP, documents/PDF, Terminal/Tasks, auth implementation, пользовательские настройки/история, общие entrypoints и build/dependencies не менялись. В main ещё не интегрировано; полной сборки, упаковки и нового бинарного релиза нет.
