# ide-update-orphan-utils-delete

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: main e7b88b4aa66. Область: update/common/updateUtils.ts и update/test/common/updateUtils.test.ts, этот отчёт. После удаления updater UI и tooltip у module нет production importers; удалить orphan version/progress/date/error/update-info URL helpers вместе с их тестами. Общий semver, platform updater service и локальные release notes не менять. Проверки source consumer search и общий client typecheck на пакете; новые зеркальные тесты для удаления не добавлять.
