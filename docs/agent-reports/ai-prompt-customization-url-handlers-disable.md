# ai-prompt-customization-url-handlers-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/ai-prompt-customization-url-handlers-disable. База: fb280c746ed3f215384155c6a49ad5ca7ddfe8d5.

P02. Область: chat/browser/promptSyntax/promptUrlHandler.ts; chat/browser/aiCustomization/aiCustomizationUrlHandler.ts; chat/test/browser/aiCustomization/aiCustomizationUrlHandler.test.ts; новый chat/test/browser/promptSyntax/promptUrlHandler.test.ts; этот отчёт. Удалить регистрацию и runtime AI URL handlers, сохранить export class/ID для shared entrypoint. Общие URL/auth/Git APIs не менять. Orphan parser удалить после проверки потребителей.

Реализация: 19fc8ff1140. Удалены DI, registration, download/create/open и AI command dispatch. Orphan parseChatCustomizationsUrl удалён, оставшихся references в src нет. Классы и ID инертны, handleURL возвращает false без чтения URI.

Проверки: 2 strict-DI browser tests (все прежние URL kinds, посторонние и unreadable URI), 0 page errors; lint и выбранные TypeScript diagnostics 4 файлов, diff --check без ошибок. Общий URL service, подтверждения других операций, Git/auth не менялись. Native smoke/общая сборка — интегратор.
