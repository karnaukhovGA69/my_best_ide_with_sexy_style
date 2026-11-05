# inline-rename-tracking-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/inline-rename-tracking-disable. База: main 41c46a51f99.

Область: src/vs/workbench/contrib/inlineCompletions/browser/renameSymbolTrackerService.ts, новый test/browser/renameSymbolTrackerDistribution.test.ts; удалить orphan inlineCompletionLanguageStatusBarContribution.ts в той же browser папке и src/vs/editor/contrib/inlineCompletions/browser/inlineCompletionsAccessibleView.ts (потребителей не осталось); этот отчёт. Workbench registration перевести на уже существующий NullRenameSymbolTrackerService из editor API: без наблюдения editors/models/cursor/typed words. Сохранить IRenameSymbolTrackerService, root import и обычный RenameProvider/command. Остальные inline models/controllers и API не менять. Общие entrypoints/dependencies и full build только интегратору.
