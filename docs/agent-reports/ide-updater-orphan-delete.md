# ide-updater-orphan-delete

Статус: ГОТОВО к интеграции следующего пакета. Владелец: интегратор/documents agent. База: integration/post-0.0.9 после четвёртого среза. Ветка: agent/ide-updater-orphan-delete.

Область: orphan реализации platform/update/electron-main: abstractUpdateService, updateService.darwin/linux/win32/snap, notAvailableUpdateDialog, unattendedRestartScheduler, updateRelaunchArguments и три соответствующих obsolete test файла. Поиск потребителей до удаления находит только этот набор. win32UpdateType и его тест сохраняются: isInnoSetupInstall используется app/main для Windows mutex. Common IUpdateService/IPC, DisabledUpdateService, ручной VSIX и release notes не меняются. Сборочный snapshot 379a3ea0067 не расширяется, package не запускается.

Удалены 11 файлов, 4360 строк: восемь orphan production modules и три теста удалённых реализаций. До удаления аудит 18 exported names и восьми module paths в src/build/test/extensions подтвердил отсутствие внешних потребителей (исторические текстовые perf fixtures исключены). После удаления ссылок на модули в исполняемых исходниках нет.

Проверки: 14 browser Mocha tests passed, 0 page errors — DisabledUpdateService/IPC, retained Windows install detection и отсутствие update UI registration. git diff --check passed. Первый запуск harness использовал неверное имя теста и не запускал тесты; после исправления пути прогон успешен. Новые тесты на отсутствие файлов не добавлялись. Full typecheck/package выполняются пакетно, текущая сборка другого агента не меняется.
