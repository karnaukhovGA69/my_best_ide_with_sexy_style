# chat-editing-editor-observers-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-editing-editor-observers-disable. База: d92644b26c240edaeb7d1386e74ab00359e0a310.

P02: удалить runtime ChatEditingEditorContextKeys и ChatEditingEditorAccessibility, которые наблюдают редакторы для AI editing sessions. Область: chat/browser/chatEditing/chatEditingEditorContextKeys.ts, chatEditingEditorAccessibility.ts; chat/test/browser/chatEditing/chatEditingEditorContributions.test.ts (новый); этот отчёт. Сохранить exported context keys и contribution IDs; удалить ObservableEditorSession после подтверждения отсутствия внешних потребителей. Общую доступность, редакторы/историю, shared entrypoints/auth не менять.
