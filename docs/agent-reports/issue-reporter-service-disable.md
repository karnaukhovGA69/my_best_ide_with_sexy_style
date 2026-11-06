# issue-reporter-service-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. База: main 354801b3e94. Ветка: agent/issue-reporter-service-disable.

Область до правок: contrib/issue/browser/issueService.ts, electron-browser/issueService.ts и test/electron-browser/issueService.test.ts. Выполнить решение удаления Issue Reporter: сохранить IWorkbenchIssueService и singleton binding, но явно отказать openReporter без auth/extension enumeration/diagnostics/window/network. Удалить obsolete helpers только при отсутствии внешних consumers. Заменить старые тесты запуска удалённого reporter на unavailable contract. Общие entrypoints/UI registrations/nativeHost и API команды не менять; остаточные UI registrations — отдельный шаг.
