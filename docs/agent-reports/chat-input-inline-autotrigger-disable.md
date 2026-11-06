# chat-input-inline-autotrigger-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-input-inline-autotrigger-disable. База: 2fc70ec91af871193f043498b52479518ffbc81e.

A01/A02: убрать настройку, повторно включающую automatic inline suggestions в chat input. Область: src/vs/workbench/contrib/chat/browser/widget/input/editor/chatInputInlineSuggestions.ts и test/browser/widget/input/editor/chatInputInlineSuggestions.test.ts относительно contrib/chat; этот отчёт. При binding установить enabled=false без configuration reads/listeners. Общий editor completion API, обычный IntelliSense, GitHub authorization/shared entrypoints исключены.
