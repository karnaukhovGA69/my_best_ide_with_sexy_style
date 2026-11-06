# chat-suggest-next-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-suggest-next-disable. База: 9be3b2c89dcbbb932398794f2f8d18a022fb398f.

P02: удалить suggested AI handoff widget/buttons. Область: src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatSuggestNextWidget.ts; browser/widget/chatWidget.ts — только renderChatSuggestNextWidget и приватные типы shown telemetry; test/browser/widget/chatContentParts/chatSuggestNextWidget.test.ts (новый); этот отчёт. Удалить также auto-send из этого render path и shown analytics, сохранив прочий chat lifecycle/history. GitHub authorization/shared entrypoints исключены.
