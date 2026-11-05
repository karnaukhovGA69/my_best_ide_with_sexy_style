# voice-input-mode-disable

Статус: ГОТОВО к интеграции. Код и тесты: `27d7289bff3`. Владелец: voice cleanup. Ветка: `agent/voice-input-mode-disable`. База: `98aa2b043b141e7b4cc74d8f8d5e38da41bf68d7`.

A06: убрать voice input mode state/storage/config subscriptions, simulations, actions/pill DOM/hold-to-talk/audio animation. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceInputMode/voiceInputMode.ts`, `src/vs/workbench/contrib/chat/browser/voiceInputMode/voiceInputModeActionViewItem.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceInputMode.test.ts` и этот отчёт. Exported contracts сохраняются как явно неактивные adapters. Shared entrypoints, GitHub/auth/Git/SSH, common API, settings portability, сборка и чужие задачи исключены.

Удалены config/storage/context subscriptions, persisted selection, walkthrough timers, mutable simulated state, mode switching/hold-to-talk dispatch, menu/keybinding descriptors, simulations registration, pill DOM/hover/touch/audio/animation. Service предоставляет constant unavailable observables; методы no-op. Action view сохраняет BaseActionViewItem contract, но render/onClick no-op, isEnabled false; constructor больше не требует voice services. Существующие context-key expressions/types сохранены.

Проверки: 4 browser tests passed (включая прежний pure context-expression test); targeted ESLint 3 файлов passed; semantic/syntactic TypeScript 3 файлов — 0; git diff --check passed. Strict DI, immutable observables/no timers, unreadable service/host inputs, отсутствие command registrations/action descriptors, unchanged DOM и no action execution. Первые browser attempts закончили tests/hooks, но HTML reporter runner не завершился до timeout; прогон с Mocha spec reporter завершился 4/4. Это исправление локального harness, не изменение product runtime. ESBuild/Playwright, без full/native build; зависимости неизменны.

Интегратору: код и отчёт с ветки. Caller createInstance(action, options) сохранён, DI dependencies удалены. Общий input/SCM/comments/keyboard smoke на пакете. Shared chat entrypoints/CSS/assets, GitHub/auth/Git/SSH/common API/main/build не менялись.
