# keyword-activation-disable

Статус: ЗАНЯТО / в работе. Владелец: агент ранее legacy-voice-chat-disable. Ветка: `agent/keyword-activation-disable`. База: `59f0fde52ec` (main).

Зарезервировано до реализации: keyword recognition region и связанные imports в `src/vs/workbench/contrib/chat/electron-browser/actions/voiceChatActions.ts`, новый `src/vs/workbench/contrib/chat/test/electron-browser/actions/keywordActivation.test.ts`, этот отчёт. Не назначать второго владельца этих файлов. Предыдущая собственная legacy-voice-chat-disable меняет другой участок того же runtime-файла; при интеграции сохранить оба результата.

A06: убрать Hey Code recognition loop, speech/config/agent listeners, динамическую регистрацию setting и statusbar command/entry. Сохранить неактивный exported contribution с ID и settings values для существующего entrypoint. Не менять общий speech API, chat.contribution entrypoint, legacy voice session cleanup из прошлой ветки, read-aloud, MCP, documents, Terminal/Tasks, build/dependencies. Полная сборка остаётся интегратору.
