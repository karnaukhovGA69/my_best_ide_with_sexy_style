# settings-search-local-only

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/settings-search-local-only. База: main 41c46a51f99.

Область: src/vs/workbench/contrib/preferences/browser/preferencesSearch.ts и новый test/browser/preferencesSearch.test.ts, этот отчёт. Удалить AI/LLM/embeddings provider orchestration и связанный settings record cache. Сохранить local string matching и TF-IDF (старый API getRemoteSearchProvider фактически уже локальный), его настройку включения и consumer interfaces. Исправить обнаруженный доступ tfIdfRankings[0].score для пустого массива (пустой каталог/нет совпадений/cancellation). Прямые сервисы AI покрыты отдельной готовой ai-search-services-disable; данная задача независима. Общие Settings UI/config entrypoints и другие файлы не менять.
