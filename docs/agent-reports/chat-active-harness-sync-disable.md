# chat-active-harness-sync-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-active-harness-sync-disable. База: fb280c746ed3f215384155c6a49ad5ca7ddfe8d5.

P02. Область: chat/browser/aiCustomization/customizationHarnessService.ts — только ActiveChatHarnessSyncContribution и его registration/imports; chat/test/browser/aiCustomization/customizationHarnessService.test.ts; этот отчёт. Отключить автоматическую синхронизацию focused chat/provisional sessions с AI customization harness. Сам CustomizationHarnessService/базовую модель, регистрацию singleton, данные и общие entrypoints не менять.

Реализация: 2da5664b8e6. ActiveChatHarnessSyncContribution инертен, его собственная startup registration удалена. Focus/provisional listeners и вызовы setActiveSession удалены. CustomizationHarnessService/базовая модель и singleton сохранены.

Проверки: combined browser suite — 18 passes, 1 platform skip, 0 failures/page errors (новый strict-DI тест и исходные common model tests). Lint и выбранные TypeScript diagnostics 2 файлов, diff --check без ошибок. Общая сборка/native smoke — интегратор.
