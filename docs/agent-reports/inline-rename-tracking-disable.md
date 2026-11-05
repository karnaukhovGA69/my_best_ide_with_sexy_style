# inline-rename-tracking-disable

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/inline-rename-tracking-disable. База: main 41c46a51f99. Владелец: чат упрощения Myself IDE.

Workbench registration IRenameSymbolTrackerService переведена на существующий NullRenameSymbolTrackerService из editor API. Удалены реализация per-model tracking, обработка typing/paste, tokenization/comment checks, наблюдение за editor focus/cursor/model content, maps моделей/редакторов. Новый adapter не читает и не хранит исходное/текущее слово. Service ID, интерфейс trackedWord и root import сохранены; trackedWord остаётся undefined.

Физически удалены два orphan UI-файла: inlineCompletionLanguageStatusBarContribution.ts и inlineCompletionsAccessibleView.ts. Поиск их путей/экспортируемых классов в src/build/test не выявил потребителей. Остальные inline controller/model/helper исходники остаются; полное удаление AI не заявляется.

Проверки: 9 browser Mocha tests passed (3 новых и 6 existing Suggest), 0 page errors. Новые проверки создают зарегистрированный singleton через strict DI без editor/model services, запрещают доступ к ним throwing Proxy и проводят реальное prepare/rename через обычный LanguageFeatureRegistry + TextModel + RenameProvider. Scoped TypeScript двух файлов — 0 diagnostics; ESLint двух файлов и git diff --check прошли. Со старым tracker из 41c46a51f99 ровно две ожидаемые failures (DI и попытка доступа к editors/models), обычное переименование проходит.

Wiring не требуется. Обычные rename provider/command, Suggest и main-thread language API не менялись. Полные typecheck/package/native выполняет интегратор на следующем пакете; текущий binary snapshot не расширялся.
