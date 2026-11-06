# agent-debug-sidecar-writers-delete

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-debug-sidecar-writers-delete. База: 9215f010f78e0a31f754c8122850eaf8ac6fa346.

P02: удалить orphan AgentHostUsageRecorder/AgentHostCustomizationRecorder и общую базу writers после agent-debug-live-capture-disable (a4c94b60da6). Область: chat/browser/chatDebug/agentHostUsageSidecar.ts; chat/test/browser/agentHostUsageSidecar.test.ts, agentHostCustomizationSidecar.test.ts; этот отчёт. Сохранить форматы/URI helpers/readers старых файлов; пользовательские logs/sidecars не удалять и не переписывать. Shared entrypoints/auth не менять.

Удалены orphan usage/customization recorders, их общая action/notification/remote-session база, очередь записи/удаления и дедупликация. Readers, URI helpers и исторические форматы сохранены. Код: d055be12d8d. Зависимость agent-debug-live-capture-disable (a4c94b60da6) уже включена merge в task-ветку.

Проверки: 4 browser tests читают legacy/versioned usage и customization snapshot, проверяют сохранность исходных bytes, отсутствие создания missing и удаления malformed files; ESLint — 3 файла; узкие TypeScript diagnostics — 3 файла, 0 ошибок; git diff --check; repo src search не нашёл оставшихся recorder references. Full build/package/native smoke не запускались. Пользовательские файлы не изменялись.
