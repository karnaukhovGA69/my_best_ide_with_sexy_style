# utility-model-settings-population-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/utility-model-settings-population-disable. База: 2880abbb1bbd5d1f0a46c470ca3d681cd9129331.

P02: удалить utility model settings dynamic population и startup registrations. Область: src/vs/workbench/contrib/chat/browser/utilityModelContribution.ts и test/browser/defaultModelContribution.test.ts — только utility test/imports, этот отчёт. Сохранить static arrays/default values для shared schema consumers; DefaultModelContribution и обычные настройки/shared entrypoints/GitHub authorization не менять.

Код: `9233d7dec15`. Utility/UtilitySmall contributions больше не наследуют model enumeration и не регистрируются при startup. Static schema arrays содержат прежний default, model services не нужны. Общий DefaultModelContribution и его остальные tests сохранены.

Проверки: 6 browser tests; ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full typecheck/build/package — интегратор. Shared schema references совместимы, дополнительных подключений нет.
