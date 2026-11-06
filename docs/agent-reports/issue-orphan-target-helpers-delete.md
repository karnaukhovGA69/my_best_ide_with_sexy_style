# issue-orphan-target-helpers-delete

Статус: ЗАВЕРШЕНО, девятый интеграционный срез. Владелец: интегратор/documents agent. База: main 5407307c532; integration/after-local-0.0.9.

Область: contrib/issue/common/issueReporterTarget.ts, common/issueReporterUtil.ts, test/common/issueReporterTarget.test.ts. После удаления UI проверить и удалить orphan target-selection helpers и obsolete tests. Common issue.ts/service contracts, CLI status, GitHub auth/catalog и sessions gitHubRepositoryResolver не менять. Совпадения старых путей в performance fixtures не менять: это данные тестов других компонентов. Проверки: consumer scan, retained issue distribution/service tests и общий пакетный typecheck.

Удалены 335 строк в 3 orphan файлах. До удаления module/export scans показывали только собственные helpers/tests; совпадение parseGitHubRepositoryFromGitConfig в sessions является другим символом. После удаления module names встречаются только в трёх performance/URI fixtures как исторические строки, не imports. 39 browser tests с retained issue distribution/service и local model consent/setup suites passed, 0 page errors. Полный client typecheck и diff --check passed. Удалённые legacy tests не заявляются пройденными; новых TS файлов нет, lint не требовался. Package/native не запускались.
