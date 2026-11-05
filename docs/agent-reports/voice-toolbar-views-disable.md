# voice-toolbar-views-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-toolbar-views-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать standalone voice/dictation toolbar renderers, hover/progress/glow/command bindings и service DI. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationActionViewItem.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/dictationDownloadActionViewItem.ts`, `src/vs/workbench/contrib/chat/browser/voiceClient/voiceModeActionViewItem.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceToolbarViews.test.ts` и этот отчёт. Сохранить non-service constructor arguments и IActionViewItem contract. Общий chatInputPart/shared entrypoints, GitHub/auth/Git/SSH/common API и чужие задачи исключены.
