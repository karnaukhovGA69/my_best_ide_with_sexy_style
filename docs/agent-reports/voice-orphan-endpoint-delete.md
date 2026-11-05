# voice-orphan-endpoint-delete

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-orphan-endpoint-delete`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить orphan voice-only WebSocket URL helpers и их obsolete tests после удаления voice/transcription transport. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceEndpoint.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceEndpoint.test.ts` и этот отчёт. Reference scan всех exported helper names и module paths находит только модуль и его tests. Общие authentication/GitHub/Git/SSH/API не меняются; это не используемый auth-provider, а невостребованный helper удалённого voice backend.
