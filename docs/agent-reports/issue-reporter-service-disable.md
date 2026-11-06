# issue-reporter-service-disable

Статус: ГОТОВО к интеграции. Владелец: чат упрощения Myself IDE. База: main 354801b3e94. Ветка: agent/issue-reporter-service-disable.

Область до правок: contrib/issue/browser/issueService.ts, electron-browser/issueService.ts и test/electron-browser/issueService.test.ts. Выполнить решение удаления Issue Reporter: сохранить IWorkbenchIssueService и singleton binding, но явно отказать openReporter без auth/extension enumeration/diagnostics/window/network. Удалить obsolete helpers только при отсутствии внешних consumers. Заменить старые тесты запуска удалённого reporter на unavailable contract. Общие entrypoints/UI registrations/nativeHost и API команды не менять; остаточные UI registrations — отдельный шаг.

Результат: browser/native сервисы сохраняют ID, singleton и openReporter contract, но больше не создают форму/окно, не собирают extensions/diagnostics/theme, не читают GitHub session и не открывают внешний issue URL. openReporter возвращает локализованный unavailable отказ, без DI dependencies и без чтения options. Удалены два getIssueReporterStyles helper: живых внешних consumers нет; одно совпадение имени в perf-data fixture является сохранённым текстом completion snapshot и не изменено. Старые tests запуска/маршрутизации reporter заменены на 4 unavailable tests; они не заявляются пройденными.

Проверки: 54 tests passed (4 новых service contract + 50 existing issueFormService tests), 0 page errors, scoped TypeScript 4 файла: 0 diagnostics, ESLint 3 изменённых TS и git diff --check passed. Изменение кода: 638 удалённых и 20 добавленных строк в трёх файлах. Native smoke и полный integration typecheck остаются пакетными проверками. Общие root/entrypoints не менялись.

Следующий конкретный шаг: browser/electron-browser issue.contribution.ts ещё регистрируют Issue Reporter UI/editor, settings, quick access, screenshot/recording/form services. Их можно убрать отдельной задачей, сохранив _issues.getSystemStatus (используется CLI diagnostic status) и согласованный extension API command. Не объявлять физическое удаление всего Issue Reporter завершённым. Для текущей ветки wiring не нужен.
