# dictation-actions-disable

Статус: ГОТОВО к интеграции. Код и тесты: `e84a57b0f96`. Владелец: voice cleanup. Ветка: `agent/dictation-actions-disable`. База: `62f2cc32a7cfd017f9fb2e1d65ae22296a0bd674`.

A06: удалить реализации отдельных dictation actions, регистрацию shortcuts/menus/commands, direct microphone picker и shortcut dispatch. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/actions/chatSpeechToTextActions.ts`, `src/vs/workbench/contrib/chat/test/browser/actions/chatSpeechToTextActions.test.ts` и этот отчёт. Сохранить exported action classes/IDs и signatures для callers. Общий chat.contribution entrypoint, GitHub/auth/catalog/backup, editor dictation, сборка и чужие задачи исключены.

Удалены registrations восьми commands, меню, keybindings, direct microphone enumeration/picker/storage, hold-mode timers, notifications/onboarding и shortcut dispatch. Экспортированные action classes/IDs/signatures сохранены как неактивные adapters с false preconditions и без menu/keybindings. Pure getDictationShortcutOperation сохранён для совместимости. Общий chat.contribution не менялся.

Проверки: 4 browser tests passed (включая прежний pure helper); targeted ESLint 2 файлов passed; semantic/syntactic TypeScript 2 файлов — 0; git diff --check passed. Проверены неизменные command/menu/keybinding registries, всегда false context gates, отсутствие services/editor/callback reads при прямом вызове. ESBuild/Playwright runner; без full/native build; зависимости неизменны, pnpm skills warning.

Интегратору: код и отчёт с этой ветки. Новый wiring не нужен. В общем smoke проверить отсутствие dictation menu/shortcuts и обычное редактирование. GitHub/auth/catalog/backup и common extension API не менялись. Editor dictation/shared dictation renderer остаются следующей независимой областью.
