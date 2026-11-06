# issue-orphan-form-contracts-delete

Статус: ЗАВЕРШЕНО, десятый интеграционный срез. Владелец: интегратор/documents agent. База: main 9af08a3006d; integration/after-local-0.0.9.

Область: src/vs/workbench/contrib/issue/common/issue.ts — только orphan IIssueFormService decorator/interface, attachment/submission contracts и ISimilarIssue. Consumer scan src/build/test/extensions не обнаружил внешних consumers этих символов. Сохранить IssueReporterData и связанные data types, IWorkbenchIssueService, process/shared contracts, совместимые команды и CLI status. GitHub auth/catalog не входят. Проверки: retained issue suites, lint и общий пакетный typecheck.

Удалены 56 строк неиспользуемых form/attachment/submission contracts. Полный symbol scan src/build/test/extensions после удаления пустой. IssueReporterData/IWorkbenchIssueService и другие data/process contracts сохранены. ESLint common/issue.ts, diff --check и полный client typecheck passed. 10 browser tests retained issue service/distribution и двух соседних chat cleanup задач passed, 0 page errors. Package/native не запускались.
