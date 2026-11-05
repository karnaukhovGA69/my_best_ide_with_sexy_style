# voice-orphan-endpoint-delete

Статус: ГОТОВО к интеграции. Код: `fa20977428d`. Владелец: voice cleanup. Ветка: `agent/voice-orphan-endpoint-delete`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить orphan voice-only WebSocket URL helpers и их obsolete tests после удаления voice/transcription transport. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceEndpoint.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceEndpoint.test.ts` и этот отчёт. Reference scan всех exported helper names и module paths находит только модуль и его tests. Общие authentication/GitHub/Git/SSH/API не меняются; это не используемый auth-provider, а невостребованный helper удалённого voice backend.

Удалены voiceEndpoint.ts и его obsolete test suite, 150 строк. Ни один production consumer не импортировал helper после integrated transport removal.

Проверки: до удаления source/build/test scan module path и всех трёх exported names обнаружил только эти два файла; после удаления — 0 ссылок; git diff --check passed. Существующий runtime не менялся, повторные browser/typecheck/full build не запускались; новых tests для отсутствующего модуля нет.

Интегратору: код и отчёт с ветки. Shared entrypoints, auth-provider APIs, GitHub/Git/SSH, product/build/main/history не менялись. Остальные pure voice helpers/types ещё имеют consumers и не удалялись.
