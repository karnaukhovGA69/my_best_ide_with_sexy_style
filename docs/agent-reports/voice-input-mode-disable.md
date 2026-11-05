# voice-input-mode-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-input-mode-disable`. База: `98aa2b043b141e7b4cc74d8f8d5e38da41bf68d7`.

A06: убрать voice input mode state/storage/config subscriptions, simulations, actions/pill DOM/hold-to-talk/audio animation. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceInputMode/voiceInputMode.ts`, `src/vs/workbench/contrib/chat/browser/voiceInputMode/voiceInputModeActionViewItem.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceInputMode.test.ts` и этот отчёт. Exported contracts сохраняются как явно неактивные adapters. Shared entrypoints, GitHub/auth/Git/SSH, common API, settings portability, сборка и чужие задачи исключены.
