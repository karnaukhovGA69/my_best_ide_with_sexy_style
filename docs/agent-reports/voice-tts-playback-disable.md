# voice-tts-playback-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее voice-session-controller-disable. Ветка: `agent/voice-tts-playback-disable`. База: `670cc65fce4` (актуальный main после релиза 0.0.8). Claim: `4cfe06bcb31`. Реализация и тесты: `716f3ff022e`.

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/ttsPlaybackService.ts`, новый `src/vs/workbench/contrib/chat/test/browser/voiceClient/ttsPlaybackService.test.ts` и этот отчёт. Область свободна, с documents-save-as и другими агентами не пересекается. Предыдущие собственные voice задачи уже включены в 0.0.8; повторно переносить их не нужно.

## Результат

A06: удалены создание/resume/close AudioContext, base64/audio decode, буферы воспроизведения, source/analyser nodes, планирование остановки, playback events, очереди Promise и хранение PCM samples. Удалена DI dependency на ILogService. Общие speech/accessibility API и сторонние аудиосервисы не менялись.

Сохранены interface/decorator/delayed singleton registration как явно неактивный compatibility adapter. isPlaying всегда false, analyserNode undefined, samples null, events Event.None. playAudioChunk/stopPlayback/closeContext не выполняют работу и не читают window; ensureContext синхронно бросает локализованную ошибку «Voice audio playback is unavailable in Myself IDE.». Обещание вернуть AudioContext не подменено фиктивным объектом; в interface документирован отказ.

Поиск по текущему src не обнаружил оставшихся production вызовов ttsPlaybackService.ensureContext/playAudioChunk после включённых transport/controller patches. UI-потребители всё ещё используют analyserNode/stopPlayback и сохранённый интерфейс; они совместимы с неактивным сервисом. Новое подключение не требуется.

## Проверки

- Browser Mocha: **8 tests, 8 passed**, disposable tracking включён.
- Проверены strict DI без зависимостей, явная ошибка ensureContext без чтения window, streaming/final/empty-final/malformed chunks без декодирования и событий.
- Sinon guards подтвердили 0 вызовов AudioContext и atob; fake timers — 0 таймеров после продвижения на 180 секунд. Повторные stop/close/dispose и вызовы после dispose не активируют воспроизведение и не сохраняют samples.
- Targeted ESLint двух файлов — passed; targeted TypeScript syntactic/semantic diagnostics двух файлов с ambient declarations — 0 diagnostics; git diff --check — passed.
- Контроль чувствительности: исходный TTS runtime из базы подставлен через esbuild loader без изменения checkout. Все 8 тестов ожидаемо упали на прежней DI dependency, доступе к AudioContext/window или несовпадении причины отказа. Guards не позволяли создать настоящий аудиоконтекст.

Первый прогон обнаружил особенность браузерного assert shim с arrow predicate в assert.throws; тесты исправлены на явный capture + проверки типа/сообщения ошибки. Финальный полный целевой прогон успешен.

Browser runner — отдельный esbuild bundle и headless Chromium из уже установленного Playwright; scratch вне репозитория. Это не официальный Electron runner, не full-project typecheck и не native smoke. Корневые dependency inputs не изменились относительно предыдущей базы, собственные node_modules переиспользованы. Зависимости не обновлялись; локальный pnpm предупреждает о неизвестном workspace setting skills.

## Интегратору

Перенести `716f3ff022e` и отчёт с ветки в следующий пакет. На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/browser/voiceClient/ttsPlaybackService.test.js`; общие DI/startup/typecheck/native smoke выполнять на накопленном пакете. Полная сборка или новый релиз для одной этой задачи не запускались.

Остаются mic capture implementation, voice UI/actions/window services, transcript store и другие общие AI/voice исходники. Этот патч убирает только реализацию ITtsPlaybackService; не заявляется удаление всей аудиосистемы, всех voice команд или всех AI функций. Common speech/accessibility, MCP, documents/PDF, Terminal/Tasks, пользовательские настройки/история, auth, entrypoints и build/dependencies не менялись. Новый патч в main ещё не интегрирован.
