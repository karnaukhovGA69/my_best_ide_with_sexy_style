# agent-plugin-store-disposal-fix

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-store-disposal-fix. База: bb3be5635574e9a356eda9c7eb6a7b9bb45bc492.

Область: chat/common/plugins/fileBackedInstalledPluginsStore.ts и test/common/plugins/fileBackedInstalledPluginsStore.test.ts; этот отчёт. Исправить позднюю инициализацию/планирование после dispose и необработанную отмену отложенной записи. Сохранить локальные данные, миграцию и рабочие записи; не менять каталог/auth/сеть.

Реализация: 4b4458a0400. Инициализация и завершение чтения проверяют disposal; watcher/миграция/новые записи после закрытия не запускаются. Ожидаемая отмена debounced write обработана, другие ошибки логируются. Уже начатую запись не прерываем; существующая отмена ещё не начатой записи сохранена.

Проверки: 50 browser tests (включая 2 новых lifecycle regression), 0 failures и 0 page errors; целевые lint и TypeScript diagnostics двух файлов без ошибок; diff --check пройден. Миграция, enablement, внешние изменения, перенос путей и persistence покрыты существующими тестами. Общая интеграционная проверка каталога с отключением updater будет в следующем зависимом задании. Сборка/native smoke — интегратор.
