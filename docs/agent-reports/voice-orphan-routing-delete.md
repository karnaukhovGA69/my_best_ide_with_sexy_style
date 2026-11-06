# voice-orphan-routing-delete

Статус: ГОТОВО к интеграции. Код: `10e52589f9b`. Владелец: voice cleanup. Ветка: `agent/voice-orphan-routing-delete`. База: `a5f8f3a0ea45ad2d305852a69e6a27df2a510a7d`.

A06: физически удалить orphan voice answer router/question narration/confirmation helpers и native voice window command module. До правок зарезервированы `src/vs/workbench/contrib/chat/common/voiceClient/voiceLiveInputRouter.ts`, `src/vs/workbench/contrib/chat/common/voiceClient/voicePendingNarration.ts`, `src/vs/workbench/contrib/chat/common/voiceClient/voiceQuestionAnswers.ts`, `src/vs/workbench/contrib/chat/common/voiceClient/voiceConfirmation.ts`, `src/vs/workbench/contrib/chat/test/common/voiceClient/voiceLiveInputRouter.test.ts`, `src/vs/workbench/contrib/chat/test/common/voiceClient/voicePendingNarration.test.ts`, `src/vs/workbench/contrib/chat/test/common/voiceClient/voiceQuestionAnswers.test.ts`, `src/vs/workbench/contrib/agentsVoice/electron-browser/agentsVoiceNativeCommands.ts` и этот отчёт. Проверка всех экспортированных имён и module names в src/test/build не нашла ссылок вне этого набора. Общие chat/speech/extension API, history/transcript store, GitHub authorization и связанные модули, Terminal/Git/SSH, shared entrypoints/build исключены.

Удалены 8 orphan файлов, 1543 строки: voice answer routing/narration/question/confirmation и unused native window command registration, вместе с obsolete tests этих helpers. Общие confirmation/question API не менялись.

Проверки: reference scan всех девяти exported symbols/module paths и native command IDs до удаления находил ссылки только внутри набора; после удаления src/test/build — 0. git diff --check passed. Runtime consumers отсутствуют, новых тестов на отсутствие файлов не добавлял; full/typecheck/package не запускались. Сохранённые service contracts не менялись.

Интегратору: код и отчёт с ветки, wiring не требуется. Старые native command module imports отсутствовали уже в базе. GitHub authorization, shared entrypoints/build/main, пользовательские данные/история и common extension API не менялись.
