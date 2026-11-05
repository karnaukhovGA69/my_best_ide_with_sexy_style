# voice-tool-dispatch-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее keyword-activation-disable. Ветка: `agent/voice-tool-dispatch-disable`. База: `59f0fde52ec` (main). Claim: `85a41557ebc`. Код и тесты: `9bc0d545693`.

До реализации закреплены `src/vs/workbench/contrib/chat/browser/voiceClient/voiceToolDispatchService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceToolDispatchService.test.ts` и этот отчёт. Область не пересекается с текущими MCP/documents задачами и предыдущими собственными voice patches.

## Результат

A06/A02: удалено выполнение backend tool calls через VoiceToolDispatchService: отправка в чат, создание/переключение сессий, выбор модели, auto-approve, чтение истории/изменений/данных сессий, ответы на вопросы и подтверждения планов/инструментов. Удалены runtime dependencies на agent sessions, chat service и language model tools; делегат больше не сохраняется и не вызывается.

`dispatchToolCall` всегда возвращает `error: voice tools are unavailable`; `respondToSession` — `{ ok: false, reason: 'unsupported' }`, включая отменённые запросы. Отказ не читает payload, не разрешает pending IDs и не меняет пользовательские данные. getActionLabel сообщает о недоступности вместо текста выполняемой операции.

Сохранены интерфейсы, decorator и delayed singleton registration как совместимый неактивный adapter. Pure `resolveVoiceModel` не менялся: его импортируют ChatViewPane и sessions voice bridge, а их общие файлы не входят в эту задачу. Сохранены четыре прежних теста model selection/recent turns; тесты удалённого поведения заменены 17 проверками недоступности.

## Проверки

- Browser Mocha: **21 tests, 21 passed** — 17 новых отказов, 4 сохранённых helper tests; disposable tracking включён.
- Проверены strict DI без сервисов, 10 имён вызовов (включая неизвестное), четыре типа structured response, canceled payload, отсутствие обращения к delegate, вызов без delegate и после его замены.
- Targeted ESLint двух изменённых файлов — passed.
- Targeted TypeScript semantic/syntactic diagnostics двух файлов с ambient declarations — 0 diagnostics. Не full-project typecheck.
- Контроль чувствительности: старый runtime из main подставлен через esbuild loader без изменения checkout; все 17 новых тестов ожидаемо падают (DI, обращение к delegate/services/payload или прежний успешный ответ), 4 helper tests проходят.
- `git diff --check` — passed.

Тесты запущены отдельным esbuild bundle и headless Chromium из уже установленного Playwright, временные файлы вне репозитория. Это не официальный Electron runner/native smoke. Переиспользованы отдельные node_modules worktree; package/lockfiles не менялись. Установленный pnpm 11.25.0 отличается от packageManager 12.16.0 и предупреждает о неизвестном workspace setting skills.

## Интегратору

Перенести `9bc0d545693` и отчёт с ветки. Дополнительного wiring не требуется; существующая регистрация сервиса сохранена. Патч независим от ранее подготовленных voice live/dictation/transcription/playback/legacy/keyword веток. На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/voiceClient/voiceToolDispatchService.test.js`; DI/startup/full typecheck и native smoke провести один раз на общем релизном пакете.

Оставшаяся область: voiceSessionController имеет отдельный send_to_chat handler через собственный live input router, а также хранение/telemetry/context handling. Эти пути не проходят через отключённый dispatcher и этим патчем не удалены. VoiceClientService transport, voice UI/actions, общий speech API и pure helpers также остаются. Нельзя объявлять все голосовые AI-функции, сеть или микрофон полностью удалёнными.

Общие контракты/entrypoints, MCP, documents/PDF, Terminal/Tasks, пользовательские настройки, auth и build/dependencies не менялись. В main ещё не интегрировано; полной сборки, упаковки и нового бинарного релиза нет.
