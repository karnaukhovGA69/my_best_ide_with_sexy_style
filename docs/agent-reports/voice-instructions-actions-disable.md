# voice-instructions-actions-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/voice-instructions-actions-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать команды настройки voice/dictation instructions, picker/workspace/home reads и автоматическое создание instruction files. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/actions/configureVoiceInstructionsAction.ts`, `src/vs/workbench/contrib/chat/test/browser/actions/configureVoiceInstructionsAction.test.ts` и этот отчёт. Exported command IDs и registration function сохраняются. Пользовательские instruction files не читать/изменять/удалять. GitHub/auth/Git/SSH/common API, shared chat entrypoint и чужие задачи исключены.
