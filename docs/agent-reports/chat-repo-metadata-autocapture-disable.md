# chat-repo-metadata-autocapture-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/chat-repo-metadata-autocapture-disable. База: 15520b78a5ddecc52a1d610a61f7c0c397b578e0.

P02. Область: chat/browser/chatRepoInfo.ts — ChatRepoInfoContribution, orphan captureRepoMetadata, их imports; новый chat/test/browser/chatRepoInfoContribution.test.ts; этот отчёт. Удалить автоматический capture SCM metadata по submit request, observers/internal diagnostic setting registration. Сохранить generateUnifiedDiff/captureRepoInfo и ручной export consumer, history/SCM/Git/auth services. Класс/ID инертны для shared entrypoint.

Реализация: ca023449da3. Автоматический submit capture, entitlement observer и internal diagnostic setting registration удалены. captureRepoMetadata удалён как orphan (references 0). Ручные diff/export функции и уже сохранённые repoData не изменены; SCM/Git/auth service реализации не затрагивались.

Проверки: strict-DI browser regression, 1 pass, 0 page errors; lint и выбранные TS diagnostics 2 файлов, diff --check без ошибок. Сравнение с базой подтвердило неизменность implementation generateUnifiedDiff/captureRepoInfo и связанных helpers. Общая сборка/native smoke — интегратор.
