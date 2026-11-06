# issue-reporter-registrations-remove

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/issue-reporter-registrations-remove. База: main f9f821d47f6.

Область: contrib/issue/{browser,electron-browser,common}/issue.contribution.ts и новый test/electron-browser/issueDistribution.test.ts. Убрать startup UI/editor/forms/capture/upload services, settings, help/quick access/performance actions и keybinding side-effect imports. Сохранить unavailable IWorkbenchIssueService binding, два compatibility command ID и _issues.getSystemStatus с реальным IProcessService passthrough. Root entrypoints/build, общие auth/Git/SSH, nativeHost и чужие задачи не менять.
