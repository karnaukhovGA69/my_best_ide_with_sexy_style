# ide-update-orphan-utils-delete

Статус: ГОТОВО, проверено и интегрировано. Владелец: интегратор/documents agent. База: main e7b88b4aa66. Область: update/common/updateUtils.ts и update/test/common/updateUtils.test.ts, этот отчёт. После удаления updater UI и tooltip у module нет production importers; удалить orphan version/progress/date/error/update-info URL helpers вместе с их тестами. Общий semver, platform updater service и локальные release notes не менять. Проверки source consumer search и общий client typecheck на пакете; новые зеркальные тесты для удаления не добавлять.

Удалены 227 строк updateUtils и 283 строки тестов только этих orphan helpers. Source import/consumer search не нашёл оставшихся ссылок; общий client typecheck и diff --check passed. На интеграционном дереве 7 context/overlay/disabled-updater tests passed, 0 page errors. Живой общий version parser и платформенные update services не менялись. Package/native не запускались.
