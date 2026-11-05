# terminal-dictation-runtime-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/terminal-dictation-runtime-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: удалить terminal dictation runtime, speech/provider dispatch, terminal text injection/decorations, timers/listeners и voice actions/install prompts. До правок зарезервированы `src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts`, `src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoiceActions.ts`, `src/vs/workbench/contrib/terminalContrib/voice/test/browser/terminalVoice.test.ts` и этот отчёт. Pure postProcessTerminalDictation и compatibility class/API сохраняются. Общий terminal entrypoint, обычные Terminal/Tasks/SSH/Git, speech extension API, auth и чужие задачи исключены.
