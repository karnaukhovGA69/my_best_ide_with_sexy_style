# voice-toolbar-views-disable

Статус: ГОТОВО к интеграции. Код и тесты: `4cdcb3e4ab3`. Владелец: voice cleanup. Ветка: `agent/voice-toolbar-views-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать standalone voice/dictation toolbar renderers, hover/progress/glow/command bindings и service DI. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/dictationActionViewItem.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/dictationDownloadActionViewItem.ts`, `src/vs/workbench/contrib/chat/browser/voiceClient/voiceModeActionViewItem.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceToolbarViews.test.ts` и этот отчёт. Сохранить non-service constructor arguments и IActionViewItem contract. Общий chatInputPart/shared entrypoints, GitHub/auth/Git/SSH/common API и чужие задачи исключены.

Удалены standalone dictation/voice/download toolbar DOM/hover/menu/progress/glow bindings и DI dependencies. Классы сохраняют caller constructor arguments, реализуют BaseActionViewItem с no-op render/onClick и isEnabled=false; обычные toolbar/menu components не менялись.

Проверки: 3 browser tests passed, по одному на renderer; targeted ESLint 4 файлов passed; semantic/syntactic TypeScript 5 файлов (включая существующий caller chatInputPart.ts) — 0; git diff --check passed. Strict DI, unreadable host options/active/container, DOM unchanged, focus/blur/click/dispose inert, no command calls. ESBuild/Playwright runner, без full/native build; зависимости неизменны.

Интегратору: код и отчёт с ветки, нового wiring не требуется. Общий input/toolbar smoke на пакете. Shared chatInputPart/CSS/menu components, GitHub/auth/Git/SSH/common API/main/build не менялись.
