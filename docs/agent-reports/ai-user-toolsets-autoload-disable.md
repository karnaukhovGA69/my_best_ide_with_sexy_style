# ai-user-toolsets-autoload-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/ai-user-toolsets-autoload-disable. База: cfb88765d2317b09bb99bb9fa790929bccf7e3f2.

P02. Область: chat/browser/tools/toolSetsContribution.ts — UserToolSetsContributions и orphan dynamic schema/imports; новый chat/test/browser/tools/userToolSetsContribution.test.ts; этот отчёт. Удалить startup reading/watch/registration/enum population для user AI tool sets. RawToolSetsShape, selection/file-format helpers, manual actions и пользовательские файлы не менять. Общие tools/JSON schema/extension/profile services сохранить; shared entrypoints не менять.

Реализация: 166cdd6ec13. UserToolSetsContributions инертен; startup wait, file/profile/tool observers, disk reads/watches, dynamic schema enumeration и runtime tool-set registration удалены. RawToolSetsShape, manual actions, selection/file-format helpers и пользовательские файлы сохранены.

Проверки: 14 browser tests без failures/page errors (новый strict-DI и исходный toolSetsContribution suite); lint и выбранные TS diagnostics 2 файлов, diff --check без ошибок. После browser run удалён unused ToolDataSource import, lint/types повторены успешно. Независим от ai-client-toolsets-disable: source files разные, существующие helper tests не менялись. Общая сборка/native smoke — интегратор.
