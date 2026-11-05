# dictation-onboarding-disable

Статус: ГОТОВО к интеграции. Код и тесты: `19717002b36`. Владелец: voice cleanup. Ветка: `agent/dictation-onboarding-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationOnboarding.ts`, `src/vs/workbench/contrib/chat/test/browser/dictationOnboarding.test.ts` и этот отчёт. A06: убрать preview microphone, waveform, picker/banner, telemetry/storage/settings actions. Сохранить общие pure microphone helpers и совместимые exports. GitHub/auth/catalog/backup, общие entrypoints, сборка и чужие области исключены.

Удалены microphone preview/capture, waveform, device enumeration/listeners, DOM/banner, telemetry, storage и commands. Сервис возвращает false/Disposable.None; banner не читает options/mediaDevices/analyser и не вызывает callbacks. Общие pure buildMicrophoneOptions/indexOfMicrophone и command IDs сохранены, interfaces совместимы. CSS/assets/shared entrypoints остаются для интегратора.

Проверки: 6 browser tests passed (3 прежних pure helper tests, 3 unavailable/runtime tests), targeted ESLint 2 файлов passed, TypeScript semantic/syntactic 2 файлов — 0, git diff --check passed. Строгий DI без services, unreadable inputs, manual/automatic preview, unchanged DOM, отсутствие media calls/listeners/timers/callbacks, repeated dispose. ESBuild/Playwright runner, не full/native build; зависимости не менялись, pnpm skills warning.

Интегратору: `19717002b36` и отчёт, совместно с остальными voice tasks. Wiring не требуется. Общий DI/startup/native smoke выполняется на пакете; singleton и pure helpers сохранены для callers. GitHub/auth/catalog/backup/main/build не менялись. Другие voice actions/decorations остаются отдельными областями.
