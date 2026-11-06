# chat-window-notifier-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-window-notifier-disable. База: fb280c746ed3f215384155c6a49ad5ca7ddfe8d5.

P02. Область: chat/browser/chatWindowNotifier.ts; chat/test/browser/chatWindowNotifier.test.ts; этот отчёт. Удалить chat observers/timers/OS notifications/focus/tool approval action из AI notifier. Сохранить инертный класс/ID для shared registration; общие notifications/host services и tool approval policy не менять.

Реализация: e216cb83729. ChatWindowNotifier инертен, удалены model trackers, timers, OS toast/focus и callback подтверждения AI tool из toast. Общие host/notifications и policy/service подтверждения не изменены.

Проверки: strict-DI browser regression, 1 pass, 0 page errors; lint и выбранные TypeScript diagnostics 2 файлов, diff --check без ошибок. Production consumers: shared registration и исторический комментарий chatListRenderer; subclasses были только в заменённых тестах. Общая сборка/native smoke — интегратор.
