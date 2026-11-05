# terminal-dictation-runtime-disable

Статус: ГОТОВО к интеграции. Код и тесты: `d042f523e67`. Владелец: voice cleanup. Ветка: `agent/terminal-dictation-runtime-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить terminal dictation runtime, speech/provider dispatch, terminal text injection/decorations, timers/listeners и voice actions/install prompts. До правок зарезервированы `src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts`, `src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoiceActions.ts`, `src/vs/workbench/contrib/terminalContrib/voice/test/browser/terminalVoice.test.ts` и этот отчёт. Pure postProcessTerminalDictation и compatibility class/API сохраняются. Общий terminal entrypoint, обычные Terminal/Tasks/SSH/Git, speech extension API, auth и чужие задачи исключены.

Удалены speech-provider/builtin dictation dispatch, terminal sendText, markers/decorations/ghost text, ARIA/hover/context listeners, timers/schedulers/cancellation и actions с install/enable speech extension prompts. Compatibility TerminalVoiceSession не имеет service dependencies; start/stop inert, singleton lookup не читает instantiationService. Pure terminal text normalizer сохранён.

Проверки: 8 browser tests passed (5 сохранённых pure helper tests); targeted ESLint 3 файлов passed после исправления имени private static _instance; semantic/syntactic TypeScript 3 файлов — 0 до этого механического rename; git diff --check passed. Strict DI, singleton lookup с unreadable service, отсутствие timers и command registrations. Без full/native build, ESBuild/Playwright runner; зависимости неизменны. После rename повторён только затронутый lint.

Интегратору: код и отчёт с ветки. terminal.voice.contribution вызывает теперь inert registration, shared entrypoints не менялись. Общий smoke Terminal typing/Tasks/SSH на пакете. Общие speech/extension API, обычные Terminal/Git/SSH/auth, настройки/история/main/build не менялись.
