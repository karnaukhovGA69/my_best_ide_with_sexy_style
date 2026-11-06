# agent-model-settings-enumeration-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-model-settings-enumeration-delete. База: be461ce28664e8257d083f6abebd2622bf9f1b8b.

P02: удалить оставшуюся AI default-model settings enumeration для Plan/Explore/Inline Chat и теперь orphan runtime base. Область: src/vs/workbench/contrib/chat/browser/planAgentDefaultModel.ts; browser/exploreAgentDefaultModel.ts; browser/defaultModelContribution.ts; test/browser/defaultModelContribution.test.ts; src/vs/workbench/contrib/inlineChat/browser/inlineChatDefaultModel.ts; этот отчёт. Static arrays/IDs и pure createDefaultModelArrays сохранить; удалить локальные startup/config registration. Зависимость: agent/utility-model-settings-population-disable. Обычный IntelliSense/settings/extension API/GitHub authorization/shared entrypoints не менять.
