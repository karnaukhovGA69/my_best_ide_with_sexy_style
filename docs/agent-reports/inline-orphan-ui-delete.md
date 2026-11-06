# inline-orphan-ui-delete

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-orphan-ui-delete. База: main 354801b3e94.

Область: только src/vs/editor/contrib/inlineCompletions/browser/view/inlineEdits/inlineEditsViews/inlineEditsWordInsertView.ts. Аудит imports по src/build/test/extensions обнаружил ноль потребителей; поиск имени класса также находит только декларацию. Удалить orphan view, не менять оставшиеся inline APIs/controller, обычный Suggest, root/build и snapshot сборщика.
