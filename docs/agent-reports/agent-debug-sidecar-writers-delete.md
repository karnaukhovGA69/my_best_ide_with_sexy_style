# agent-debug-sidecar-writers-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/agent-debug-sidecar-writers-delete. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить orphan AgentHostUsageRecorder/AgentHostCustomizationRecorder и общую базу writers после agent-debug-live-capture-disable (a4c94b60da6). Область: chat/browser/chatDebug/agentHostUsageSidecar.ts; chat/test/browser/agentHostUsageSidecar.test.ts, agentHostCustomizationSidecar.test.ts; этот отчёт. Сохранить форматы/URI helpers/readers старых файлов; пользовательские logs/sidecars не удалять и не переписывать. Shared entrypoints/auth не менять.
