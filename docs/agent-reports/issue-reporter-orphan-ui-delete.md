# issue-reporter-orphan-ui-delete

Статус: ГОТОВО к интеграции. Владелец: чат упрощения Myself IDE. Ветка: agent/issue-reporter-orphan-ui-delete. База: main f9f821d47f6 плюс agent/issue-reporter-registrations-remove (с service-disable). Зависимости объединены только в своём task worktree.

Область: физическое удаление orphan Issue Reporter UI/runtime/tests/media после снятия регистраций. Аудит imports по src/build/test/extensions не нашёл внешних потребителей 30 TS файлов. Common contracts/helpers/fixtures, unavailable issue/upload adapters, новые distribution/service tests и общий nativeHost не входят. Удаляемые файлы:

- src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts
- src/vs/workbench/contrib/issue/browser/issueFormService.ts
- src/vs/workbench/contrib/issue/browser/issueReporterEditorInput.ts
- src/vs/workbench/contrib/issue/browser/issueReporterMedia.ts
- src/vs/workbench/contrib/issue/browser/issueReporterModel.ts
- src/vs/workbench/contrib/issue/browser/issueReporterOverlay.ts
- src/vs/workbench/contrib/issue/browser/issueReporterPage.ts
- src/vs/workbench/contrib/issue/browser/issueReporterRepositoryPicker.ts
- src/vs/workbench/contrib/issue/browser/issueReporterService.ts
- src/vs/workbench/contrib/issue/browser/media/issueReporter.css
- src/vs/workbench/contrib/issue/browser/media/issueReporterOverlay.css
- src/vs/workbench/contrib/issue/browser/media/issueReporterRepositoryPicker.css
- src/vs/workbench/contrib/issue/browser/recordingService.ts
- src/vs/workbench/contrib/issue/browser/screenshotAnnotation.ts
- src/vs/workbench/contrib/issue/browser/screenshotService.ts
- src/vs/workbench/contrib/issue/electron-browser/issueReporterController.ts
- src/vs/workbench/contrib/issue/electron-browser/issueReporterEditorPane.ts
- src/vs/workbench/contrib/issue/electron-browser/issueReporterKeybindings.ts
- src/vs/workbench/contrib/issue/electron-browser/issueReporterService.ts
- src/vs/workbench/contrib/issue/electron-browser/nativeIssueFormService.ts
- src/vs/workbench/contrib/issue/electron-browser/nativeRecordingService.ts
- src/vs/workbench/contrib/issue/electron-browser/nativeScreenshotService.ts
- src/vs/workbench/contrib/issue/test/browser/baseIssueReporterService.test.ts
- src/vs/workbench/contrib/issue/test/browser/issueFormService.test.ts
- src/vs/workbench/contrib/issue/test/browser/issueReporterMedia.test.ts
- src/vs/workbench/contrib/issue/test/browser/issueReporterOverlay.test.ts
- src/vs/workbench/contrib/issue/test/browser/issueReporterRepositoryPicker.test.ts
- src/vs/workbench/contrib/issue/test/browser/recordingService.test.ts
- src/vs/workbench/contrib/issue/test/browser/testReporterModel.test.ts
- src/vs/workbench/contrib/issue/test/electron-browser/issueReporterMediaImport.test.ts
- src/vs/workbench/contrib/issue/test/electron-browser/issueReporterRecording.test.ts
- src/vs/workbench/contrib/issue/test/electron-browser/nativeIssueFormService.test.ts
- src/vs/workbench/contrib/issue/test/electron-browser/nativeRecordingService.test.ts

Результат: удалены 33 файла, 19435 строк — 30 TS реализации/obsolete tests и 3 CSS. Убраны UI form/page/overlay/editor/controller, screenshot annotation, recording/media runtime и прежние тесты этих удалённых компонентов. Общие контракты/helpers и их tests сохранены; source-only upload adapters не входят в удаление (их отдельный disable task ещё должен быть принят).

Проверки: повторный аудит относительных imports/from/dynamic import/require всех src/build/test/extensions не нашёл ни одного missing import внутри contrib/issue. Поиск build/test прямых references обнаружил только i18n namespace vs/workbench/contrib/issue, который остаётся действительным для сохранённых common/service файлов. 35 tests passed (3 distribution, 4 unavailable service, 28 common target/helper), 0 page errors в изолированном Chromium harness. Scoped TypeScript 4 contribution/distribution файла: 0 diagnostics. git diff --check passed. Production TS только удаляется, lint новых TS не требуется. Удалённые legacy tests не заявляются как пройденные; сборка приложения/native smoke ещё не выполнялись.

Интеграция: ветка включает issue-reporter-registrations-remove e9dbbc57be3 и issue-reporter-service-disable 9dbcd1c32cf. Принимать цепочку вместе, подключение root entrypoints не нужно. После интеграции общий typecheck/bundle подтверждает полноту графа; native --status и обычный editor/Git/Tasks smoke остаются пакетными проверками. Общий nativeHost RPC uploadFileViaMobileApi и source-only upload adapters ещё есть; пользовательские настройки/профили/данные не изменены.
