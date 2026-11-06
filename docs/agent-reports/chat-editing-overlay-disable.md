# chat-editing-overlay-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-editing-overlay-disable. База: ee6f4e41f92b323f499ac244a6541ef808c0568f.

P02. Область: chat/browser/chatEditing/chatEditingEditorOverlay.ts; его media/chatEditingEditorOverlay.css; новый chat/test/browser/chatEditing/chatEditingEditorOverlay.test.ts; этот отчёт. Удалить editor-group observers, overlay/controller/action-view runtime и orphan CSS после проверки references. Сохранить инертный ChatEditingEditorOverlay/ID для shared registration. Обычные редакторы/diff/undo/editor groups и общие entrypoints не менять.

Уточнение области до изменения CSS: добавить media/chatEditorController.css только для переноса существующего disabled-action rule для .chat-diff-change-content-widget. Правило имеет живых consumers в text/notebook diff widgets; его сохранить при удалении overlay stylesheet. Остальные правила controller CSS не менять.
