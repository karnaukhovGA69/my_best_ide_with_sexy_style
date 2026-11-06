# agent-mode-picker-runtime-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-mode-picker-runtime-disable. База: d92644b26c240edaeb7d1386e74ab00359e0a310.

P02: удалить runtime AgentHostModeSynchronizer и экспериментальное включение существующего session harness picker. Область: chat/browser/agentSessions/agentHost/agentHostModeSynchronizer.ts, agentHostExistingSessionHarnessPickerEnablement.ts; соответствующие chat/test/browser/agentSessions/*.test.ts; этот отчёт. Сохранить contribution IDs, существующие данные/настройки/историю. Удалить локальную startup registration synchronizer; shared entrypoints/auth/catalog/обычные editor settings не менять.

Удалены синхронизация режимов/сессий, widget/backend subscriptions, storage reads/writes и экспериментальное включение harness picker. Сохранены инертные contribution classes/IDs; собственная startup registration synchronizer удалена. Default context key picker уже false. История и сохранённые настройки не очищались. Код: abd232320d0.

Проверки: 2 browser tests — strict DI без session/config/storage/experiment services; ESLint — 4 файла; узкие TypeScript diagnostics — 4 файла, 0 ошибок; git diff --check. Полные build/package/native smoke не запускались. Shared entrypoints/auth не менялись.
