# ai-client-toolsets-disable

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/ai-client-toolsets-disable. База: 26089a34d61f2b1408a89af87ea08daa4dc17791.

P02. Область: chat/browser/tools/clientToolSetsContribution.ts; chat/test/browser/tools/toolSetsContribution.test.ts — только client-contribution tests/imports; этот отчёт. Удалить startup dynamic tool-set registrations/membership observers. Класс/ID сохранить инертными; общие tools service, Task/Notebook/browser/remote APIs, file format helpers и shared entrypoint не менять.

Реализация: d1f179950a5. ClientToolSetsContribution инертен; built-in tool sets, dynamic reconciliation и onDidChangeTools observers удалены. Основные Task/browser/notebook/remote API не изменены.

Проверки: 10 browser tests без failures/page errors (strict-DI и сохранившиеся selection/file-format cases); lint и выбранные TS diagnostics 2 файлов, diff --check без ошибок. Общая сборка/native smoke — интегратор.
