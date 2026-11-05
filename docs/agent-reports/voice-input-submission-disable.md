# voice-input-submission-disable

Статус: ГОТОВО к интеграции. Код и тесты: `29c7820b2cb`. Владелец: voice cleanup. Ветка: `agent/voice-input-submission-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать acceptVoiceInput dispatch/editing/queue routing из shared helper. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceInputUtils.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceInputUtils.test.ts` и этот отчёт. Сохранить pure combineVoiceInput для callers и существующий public signature. ChatViewPane/Sessions bridge/shared entrypoints, auth/Git/SSH/common API, настройки/история и чужие задачи исключены.

acceptVoiceInput теперь возвращает false без чтения widget/viewModel/draft, без редактирования input, отправки запроса или steering queue. Pure combineVoiceInput и public return signature сохранены. Обычный input/submit path не менялся.

Проверки: 3 browser tests passed (включая прежний combine helper); targeted ESLint 2 файлов passed; semantic/syntactic TypeScript 2 файлов — 0; git diff --check passed. Проверены unreadable widget, missing/empty input, обе voice flags, неизменность draft и отсутствие reads/edits/submissions. ESBuild/Playwright runner; без full/native build, зависимости неизменны.

Интегратору: код и отчёт с ветки. Shared ChatViewPane caller автоматически получает false; отдельный Sessions voiceBridge содержит собственный submit path и остаётся областью shared entrypoint cleanup интегратора. Main/build/auth/Git/SSH/history не менялись.
