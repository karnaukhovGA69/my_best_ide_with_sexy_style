# session-picker-tryout-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/session-picker-tryout-disable. База: 8a9f66bc9af61dfa3a8e4648fd1989392f79a2d4.

A06: снять Sessions model picker tryout presentation/runtime. Область: src/vs/sessions/contrib/chat/browser/newSessionPickerTryout.ts и src/vs/sessions/contrib/chat/test/browser/newSessionPickerTryout.test.ts, этот отчёт. Module оставить inert для side-effect imports, shared onboarding registry/newChatWidget/main/GitHub authorization исключены. Exported classes используются только в собственном тесте.
