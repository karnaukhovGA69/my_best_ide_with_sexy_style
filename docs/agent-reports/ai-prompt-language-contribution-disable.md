# ai-prompt-language-contribution-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/ai-prompt-language-contribution-disable. База: e7b88b4aa66a726c2c00653bbf3ab2425049d004.

P02. Область: chat/browser/promptSyntax/promptFileContributions.ts; новый chat/test/browser/promptSyntax/promptFileContributions.test.ts; этот отчёт. Удалить AI prompt provider registrations и приватные editor/model validators/trackers. Класс/ID оставить инертным для shared registration. Общие language features/IntelliSense, Markdown, marker service, форматы файлов и переиспользуемые prompt parsers/providers не менять.

Реализация: b6f95b79498. AI prompt link/completion/hover/definition/token/code-action providers не регистрируются; приватные PromptValidatorContribution/ModelTracker и listeners/timers удалены. Общие language/marker services и переиспользуемые parsers/providers не изменены.

Проверки: strict-DI browser regression, 1 pass, 0 page errors; lint и выбранные TS diagnostics 2 файлов, diff --check без ошибок. Production consumer — shared registration, ID сохранён. Обычный IntelliSense/native editor smoke и общая сборка — интегратор.
