# ide-updater-orphan-workbench-delete

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: b21b4ea407b. Ветка: agent/ide-updater-orphan-workbench-delete.

Область: workbench/contrib/update/browser/{outdatedBuildReminder,unattendedRestartExperimentTrigger,unattendedRestartParticipants}.ts и три соответствующих test/browser файла. До удаления проверить все exports/imports. UpdateTitleBarEntry остаётся: у него есть потребитель в Sessions. Release notes, общие lifecycle/editor contracts, user state и GitHub исключены. Проверки пакетно; чужой package не запускается.

Удалены 6 файлов (952 строки), включая три obsolete test файла. Аудит 7 exported symbols и трёх module paths в src/build/test/extensions подтвердил отсутствие внешних consumers. Совпадение строки update.outdatedBuildReminder в общем notification enum не является consumer и оставлено без изменения. После удаления 14 retained updater browser tests passed, 0 page errors; diff --check passed. Новые тесты на отсутствие файлов не добавлялись; общий client typecheck будет выполнен на шестом срезе.
