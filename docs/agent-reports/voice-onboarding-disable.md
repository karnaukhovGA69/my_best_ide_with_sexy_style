# voice-onboarding-disable

Статус: ГОТОВО к интеграции. Код и тесты: `985228057a5`. Владелец: voice cleanup. Ветка: `agent/voice-onboarding-disable`. База: `5f88b8b3d41`.

До правок зарезервированы `src/vs/workbench/contrib/agentsVoice/browser/voiceModeOnboarding.ts`, `src/vs/workbench/contrib/agentsVoice/test/browser/voiceModeOnboarding.test.ts` и этот отчёт. A06: убрать voice introduction/banner, samples playback, microphone enumeration, model/voice selection, storage/telemetry/DOM listeners. Сохранить совместимые exports для UI host/fixtures. Не трогать common entrypoints, GitHub/auth/backup, assets/build, других агентов.

Удалена onboarding implementation: sample audio player/animation, media enumeration/capture, settings selection, commands, listeners, storage и telemetry. Service isVisible/show всегда false, registerHost возвращает disposable без чтения host. Exported banner — inert Disposable без DOM/audio/focus, сохранён для component fixture compatibility. Assets/CSS остались на диске; shared ChatInputOnboarding не менялся.

Проверки: 5 browser tests passed (3 unavailable + 2 прежних policy/context-key tests); targeted ESLint и TypeScript двух файлов passed/0 diagnostics; git diff --check passed. Direct banner construction не меняет container, не вызывает audioFactory/Audio/getUserMedia/enumerateDevices и timers, strict DI работает без зависимостей. ESBuild/Playwright runner; не native smoke/full typecheck. Dependencies неизменны, локальный pnpm warning skills.

Интегратору: `985228057a5` и отчёт, wiring не нужен. Целевой voiceModeOnboarding.test.js на общем output, включая compatibility fixture compile; fixture теперь намеренно пустая. Common entrypoints/UI host imports остаются для последующего cleanup. Main/build/release не менялись. GitHub/auth/catalog/backup исключены по указанию пользователя.
