# chat-editing-editor-observers-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-editing-editor-observers-disable. База: d92644b26c240edaeb7d1386e74ab00359e0a310.

P02: удалить runtime ChatEditingEditorContextKeys и ChatEditingEditorAccessibility, которые наблюдают редакторы для AI editing sessions. Область: chat/browser/chatEditing/chatEditingEditorContextKeys.ts, chatEditingEditorAccessibility.ts; chat/test/browser/chatEditing/chatEditingEditorContributions.test.ts (новый); этот отчёт. Сохранить exported context keys и contribution IDs; удалить ObservableEditorSession после подтверждения отсутствия внешних потребителей. Общую доступность, редакторы/историю, shared entrypoints/auth не менять.

Удалены подписки на смену редакторов/групп и AI editing sessions, обновление AI context keys и AI-specific accessibility signals при переключении файлов. Сами exported context keys/IDs сохранены. ObservableEditorSession удалён после repo-wide поиска: внешний consumer отсутствует. Код: 2a97f527d25.

Проверки: 2 browser tests — strict DI без editor/group/session/accessibility services; ESLint — 3 файла; узкие TypeScript diagnostics — 3 файла, 0 ошибок; git diff --check. История/файлы и общая доступность редактора не менялись. Полные build/package/native smoke не запускались; shared entrypoints не менялись.
