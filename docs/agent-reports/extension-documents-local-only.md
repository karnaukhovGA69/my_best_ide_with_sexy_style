# extension-documents-local-only

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/extension-documents-local-only. База: актуальный локальный main.

Область: workbench/contrib/extensions/browser/extensionEditor.ts (CSP README/changelog), extensionsWorkbenchService.ts (getReadme/getChangelog и availability), соответствующие tests/browser и этот отчёт. Убрать сетевой fallback загрузки Markdown описания/истории расширения и внешние media внутри этих документов. Сохранить локальное содержимое установленного VSIX, ручные ссылки и остальные extension management операции. Общий markdownDocumentRenderer, gettingStarted, release notes и другие claims не менять. Целевые regression tests/lint/scoped TS; пакет/native у интегратора.
