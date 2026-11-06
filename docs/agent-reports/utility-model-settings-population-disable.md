# utility-model-settings-population-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/utility-model-settings-population-disable. База: 2880abbb1bbd5d1f0a46c470ca3d681cd9129331.

P02: удалить utility model settings dynamic population и startup registrations. Область: src/vs/workbench/contrib/chat/browser/utilityModelContribution.ts и test/browser/defaultModelContribution.test.ts — только utility test/imports, этот отчёт. Сохранить static arrays/default values для shared schema consumers; DefaultModelContribution и обычные настройки/shared entrypoints/GitHub authorization не менять.
