# chat-thinking-title-generation-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/chat-thinking-title-generation-disable. База: 2880abbb1bbd5d1f0a46c470ca3d681cd9129331.

P02: удалить thinking-title AI generation/cache writes, сохранив read-only legacy cache reuse для истории. Область: src/vs/workbench/contrib/chat/common/chatThinkingTitleService.ts и test/common/chatThinkingTitleService.test.ts, этот отчёт. Сохранить public contracts, cache validation/TTL/external invalidation; не удалять существующие данные. GitHub authorization/shared entrypoints исключены.
