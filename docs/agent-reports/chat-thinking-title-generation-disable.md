# chat-thinking-title-generation-disable

Статус: ГОТОВО К ИНТЕГРАЦИИ. Владелец: voice cleanup. Ветка: agent/chat-thinking-title-generation-disable. База: 2880abbb1bbd5d1f0a46c470ca3d681cd9129331.

P02: удалить thinking-title AI generation/cache writes, сохранив read-only legacy cache reuse для истории. Область: src/vs/workbench/contrib/chat/common/chatThinkingTitleService.ts и test/common/chatThinkingTitleService.test.ts, этот отчёт. Сохранить public contracts, cache validation/TTL/external invalidation; не удалять существующие данные. GitHub authorization/shared entrypoints исключены.

Код: `7e8c55120d7`. Удалены model selection/request, prompt construction, pending entries, write scheduler/save hooks. getCachedTitle/generateTitle могут только читать прежние titles с прежними validation/TTL/legacy keys; external invalidation сохранена, stored cache не удаляется/перезаписывается. DI оставлен для storage/log, model/config dependencies удалены.

Проверки: 4 browser tests (legacy history/no writes, external updates, invalid/expired entries preserved, cancellation/relevance/dispose); ESLint 2 файлов; selected-file semantic types (0 diagnostics); git diff --check — passed. Full typecheck/build/package — интегратор. Подключений нет.
