# voice-input-submission-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-input-submission-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать acceptVoiceInput dispatch/editing/queue routing из shared helper. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceInputUtils.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceInputUtils.test.ts` и этот отчёт. Сохранить pure combineVoiceInput для callers и существующий public signature. ChatViewPane/Sessions bridge/shared entrypoints, auth/Git/SSH/common API, настройки/история и чужие задачи исключены.
