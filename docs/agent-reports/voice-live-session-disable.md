# voice-live-session-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ; повторно не назначать. Владелец: агент ранее ai-terminal-cleanup-refresh. Ветка: `agent/voice-live-session-disable`. База: `59f0fde52ec` (main). Claim: `1f65d0dcb75`; реализация и тесты: `fce7f8d050c`. Предыдущая терминальная task-ветка сохранена отдельно и ожидает integration; этот патч от неё не зависит.

## Назначение и границы

Задание из A06 project-plan: отключить оставшийся мост голосовых AI live sessions, сохранив совместимость общих речевых сервисов. До реализации область закреплена в этом отчёте, копия сразу помещена в общий каталог отчётов.

Изменены только `src/vs/workbench/contrib/speech/browser/speechService.ts`, `src/vs/workbench/contrib/speech/test/browser/voiceLiveSession.test.ts` и этот отчёт. MCP API/discovery/gallery, documents/PDF, Terminal/Tasks, общие entrypoints, extension API/protocol, build/product/package/lockfiles не менялись. Использован собственный ранее выделенный каталог; чужие ветки и файлы не изменены.

## Проверенная цепочка и результат

До патча `SpeechService.createVoiceLiveSession` вызывал `extensionService.activateByEvent('onSpeech')`, находил провайдера в Map и передавал ему SDP/token. Это происходило даже при проверке доступности без SDP. Наличие скрытого UI и отсутствующего defaultChatAgent ограничивало основной caller, но не отключало сам bridge.

Проверены внешние потребители: `MainThreadSpeech` регистрирует провайдер через тот же интерфейс и хранит возвращённый IDisposable; `VoiceClientService._executeGptLiveSessionCommand` использует результат, а availability/connection ветки обрабатывают undefined как отсутствие live-сессии. Сигнатуры `ISpeechService`, RPC и proposed API не изменены.

Теперь live-регистрация возвращает `Disposable.None`, не хранит объект провайдера и не читает его metadata. Map live-провайдеров удалён. Запрос live-сессии всегда возвращает undefined без активации расширения или вызова callback; это также относится к проверке доступности, отменённому запросу, неизвестному ID и повторной регистрации. Ответ соответствует уже существовавшему состоянию отсутствующего провайдера.

При проверках выявлено, что `SpeechService` не освобождал handler, возвращаемый `speechProvidersExtensionPoint.setHandler`: после dispose новый экземпляр падал с `Handler already set!`. Handler теперь зарегистрирован в Disposable сервиса. Отдельная регрессия проверяет dispose → создание следующего сервиса. В рабочем экземпляре обработка обычных speech providers сохранена.

## Проверки

- `git diff --check`: успешно; diff ограничен назначенной областью, необходимые базовые коммиты являются предками HEAD.
- Целевой `pnpm run eslint` для двух изменённых TS-файлов: успешно.
- `speech/test/browser/voiceLiveSession.test.ts` и существующий `speech/test/common/speechService.test.ts`: **5 tests, 5 passed**, включая проверку disposables. Запуск: целевой esbuild bundle реальных модулей, Mocha и repository assert shim в headless Chromium. Стили и статические ресурсы исключены из browser test bundle; product-модули не подменялись. Extension service и speech providers — тестовые, физический микрофон и внешние службы не использовались.
- Live-регрессии проверяют availability/request, совпадающий/чужой extension ID, неизвестный provider ID, отмену, снятую регистрацию, дубликаты и повторный dispose; activations и вызовы провайдера остаются пустыми, speech provider state не меняется.
- Проверка совместимости обычной речи подтверждает `onSpeech`, передачу языка/токена, возврат исходных speech-to-text/text-to-speech сессий, synthesize, active state и завершение по cancellation/unregister.
- Проверена чувствительность тестов: до отключения bridge (после отдельного исправления dispose handler) обе live-регрессии падали на реальном вызове provider и duplicate registration, обычная речь и language test проходили. После отключения все тесты прошли.

Переиспользованы собственные зависимости рабочего каталога. Новых пакетов нет. Launcher среды использует pnpm 11.25.0 при закреплённом 12.16.0; версии и lockfile не менялись. Полный typecheck, production package, native smoke и релиз не запускались по правилу пакетных сборок.

## Интегратору

Перенести `agent/voice-live-session-disable` либо кодовый коммит `fce7f8d050c` с этим отчётом. Дополнительное wiring не требуется: `speech.contribution.ts` уже регистрирует настоящий SpeechService. Общие DI/API контракты сохранены. Патч независим от ai-terminal-cleanup-refresh и MCP-задач.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/speech/test/browser/voiceLiveSession.test.js` и соответствующий `vs/workbench/contrib/speech/test/common/speechService.test.js`; общие проверки включить в накопленный пакет. Перед релизом проверить native startup/extension host и отсутствие голосового UI по общему плану. Browser suite не заменяет native smoke.

Ограничения: API bridge/extHost provider storage, VoiceClientService, обычные речевые провайдеры, speech settings/telemetry call sites и прочие голосовые исходники остаются. Этот патч отключает только live-session путь через SpeechService; он не доказывает удаление всего voice/transcription/AI, всех RPC, отсутствие сетевого трафика или захвата аудио по другим путям. Обычные speech-to-text/text-to-speech/keyword и accessibility не удалены; реальный звук и keyword recognition не проверялись.

В main ещё не объединено, нового бинарного релиза нет.
