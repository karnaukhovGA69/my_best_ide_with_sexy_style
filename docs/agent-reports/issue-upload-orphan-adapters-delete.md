# issue-upload-orphan-adapters-delete

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: main fcee67ec484; integration/after-local-0.0.9.

Область: contrib/issue/browser/githubUploadService.ts, electron-browser/nativeGitHubUploadService.ts, test/electron-browser/githubUploadService.test.ts, test/common/issueReporterMediaFixtures.ts. Удалить orphan adapters и obsolete fixtures/tests после принятого reporter UI/RPC удаления. Перед удалением проверить imports и экспортируемые символы. Сохранить issueDistribution tests отсутствия service registration, unavailable issue service/API commands, common helpers, CLI status. GitHub auth/catalog не входят. Проверки — retained issue suites и общий typecheck вместе с новым интеграционным пакетом.
