# voice-tool-dispatch-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее keyword-activation-disable. Ветка: `agent/voice-tool-dispatch-disable`. База: `59f0fde52ec` (main).

До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceToolDispatchService.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceToolDispatchService.test.ts` и этот отчёт. Не назначать второго владельца этих файлов.

A06/A02: удалить выполнение голосовых backend tool calls, доступ к сессиям/истории/changes, переключение модели/сессии, auto-approve и ответы/подтверждения. Сохранить интерфейсы, singleton registration, pure model resolver и совместимый отказ без side effects. Не менять voiceSessionController, voice transport, общие контракты/entrypoints, чужие MCP/documents области, Terminal/Tasks или зависимости. Полная сборка принадлежит интегратору.
