# documentation-import-lifecycle

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: a94c22863e4. Область: extensions/myself-documents/src/library.ts (import/remove lifecycle), test/library-host.test.cts и этот отчёт. Проверить и остановить pending/queued imports после dispose до записи; при dispose после начала записи завершить или откатить согласованно, без записи metadata на удалённый файл. Проверить failed metadata/write и очередь. Не менять UI/layout/темы/GitHub/новые форматы. Scoped extension tests/types/lint; full package не запускать.
