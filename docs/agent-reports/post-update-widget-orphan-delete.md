# post-update-widget-orphan-delete

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: fa5f110f488. Ветка: agent/post-update-widget-orphan-delete.

Область: src/vs/workbench/contrib/update/browser/postUpdateWidget.ts, media/postUpdateWidget.css и test/electron-browser/postUpdateWidget.test.ts. Удаление уже отключённого post-update popup после проверки consumers. Ручные release notes, общий update.ts с account-related кодом, shared entrypoints и GitHub не меняются. Пользовательское storage не удалять.

Удалены 3 файла, 605 строк. Поиск module/class/style references в src/build/test/extensions показал замкнутый набор, после удаления совпадений нет (исторические perf fixtures исключены). 14 retained updater browser tests passed, 0 page errors; git diff --check passed. Full typecheck — на седьмом интеграционном срезе. Новые тесты на отсутствие файлов не добавлялись, пользовательские данные не менялись.
