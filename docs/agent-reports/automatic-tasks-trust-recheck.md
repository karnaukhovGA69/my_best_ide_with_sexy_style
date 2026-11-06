# automatic-tasks-trust-recheck

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: main bb3be563557. Область: tasks/browser/runAutomaticTasks.ts, новый tasks/test/browser/runAutomaticTasks.test.ts, этот отчёт. Повторно проверять Workspace Trust и disposal после асинхронного получения задач/разрешения и перед автоматическим вызовом run. Начальный trust gate и ручной task service не менять. Проверки: trusted run, untrusted entry, revoke during discovery/resolution, disposed owner; пакетная DI типизация вместе со startup terminal guard.
