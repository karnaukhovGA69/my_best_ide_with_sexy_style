# issue-reporter-orphan-ui-delete

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/issue-reporter-orphan-ui-delete. База: main f9f821d47f6 плюс agent/issue-reporter-registrations-remove (с service-disable). Зависимости объединены только в своём task worktree.

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
