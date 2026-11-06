# local-model-ready-offer-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/local-model-ready-offer-disable. База: 8ddb6cc01c59dcd4a86ae5d3791bbf92adc700a9.

P02/A06: удалить local AI model ready offers, runtime observers, ready-offer commands, их analytics и orphan helpers/constants после consumer scan. Область: src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/localModelReadyNotification.ts и test/browser/agentSessions/localModelReadyNotification.test.ts, этот отчёт. Сохранить contribution и registration function как inert compatibility; не менять model install/removal service, user files/history/GitHub authorization/shared entrypoints.
