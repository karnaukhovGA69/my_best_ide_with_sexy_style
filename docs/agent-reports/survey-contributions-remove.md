# survey-contributions-remove

Статус: ГОТОВО к интеграции. Владелец: интегратор/documents agent. База: 98aa2b043b1. Ветка: agent/survey-contributions-remove.

P05/P02: удалить runtime NPS/language surveys и Copilot survey entrypoint. Область: три *.contribution.ts в contrib/surveys/browser, новый test/browser/survey.contribution.test.ts, imports в workbench.common.main.ts/workbench.desktop.main.ts/workbench.web.main.ts. Sessions entrypoints могут продолжать импортировать инертный модуль. Другие feedback widgets/issue reporters в этой задаче не меняются. Общие Git/SSH/auth API, активные MCP/voice/inline/settings задачи не трогать.

Удалены регистрации NPS/language surveys, session counters/listeners/storage/notification dispatch, survey commands/editor/accessible view и три runtime imports. Совместимые contribution modules инертны; underlying editor/questions и отдельные chat feedback widgets пока остаются. Это не полное удаление всех feedback механизмов.

Проверки: 3 browser tests passed, 0 page errors; целевой ESLint 7 файлов и git diff --check прошли. Проверены отсутствие command IDs, editor pane и menu entry. В тесте исправлена потеря type-only import при esbuild и дублирование import; финальный прогон чистый. Общий typecheck/package/native smoke выполняется на пакете.
