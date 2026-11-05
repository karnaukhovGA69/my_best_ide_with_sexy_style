# dictation-actions-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: `agent/dictation-actions-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

A06: удалить реализации отдельных dictation actions, регистрацию shortcuts/menus/commands, direct microphone picker и shortcut dispatch. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/actions/chatSpeechToTextActions.ts`, `src/vs/workbench/contrib/chat/test/browser/actions/chatSpeechToTextActions.test.ts` и этот отчёт. Сохранить exported action classes/IDs и signatures для callers. Общий chat.contribution entrypoint, GitHub/auth/catalog/backup, editor dictation, сборка и чужие задачи исключены.
