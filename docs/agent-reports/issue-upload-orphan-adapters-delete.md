# issue-upload-orphan-adapters-delete

Статус: ЗАВЕРШЕНО, восьмой интеграционный срез. Владелец: интегратор/documents agent. База: main fcee67ec484; integration/after-local-0.0.9.

Область: contrib/issue/browser/githubUploadService.ts, electron-browser/nativeGitHubUploadService.ts, test/electron-browser/githubUploadService.test.ts, test/common/issueReporterMediaFixtures.ts. Удалить orphan adapters и obsolete fixtures/tests после принятого reporter UI/RPC удаления. Перед удалением проверить imports и экспортируемые символы. Сохранить issueDistribution tests отсутствия service registration, unavailable issue service/API commands, common helpers, CLI status. GitHub auth/catalog не входят. Проверки — retained issue suites и общий typecheck вместе с новым интеграционным пакетом.

Удалены 4 orphan файла (92 строки): два adapters, их obsolete tests и unused media fixtures. До удаления module/export consumer scan находил только внутренние imports/tests; после удаления упоминаний модулей/экспортов нет. Строка githubUploadService в сохранённом distribution test намеренно проверяет отсутствие регистрации. 36 browser tests с retained issue contracts/helpers/distribution и local model offers passed, 0 page errors. Полный client typecheck и diff --check passed. Удалённые тесты не заявляются пройденными; новых TS файлов нет, lint не требовался. Package/native не запускались.
