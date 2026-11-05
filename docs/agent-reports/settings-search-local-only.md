# settings-search-local-only

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/settings-search-local-only. База: main 41c46a51f99. Владелец: чат упрощения Myself IDE.

Удалены AI/LLM/embeddings orchestration и settings-record cache из PreferencesSearchService. getAiSearchProvider всегда возвращает undefined и не получает AI service из DI. Сохранены обычный поиск по ключам/описанию и полностью локальный TF-IDF. Старое имя getRemoteSearchProvider остаётся для совместимости SettingsEditor, но теперь напрямую создаёт TfIdfSearchProvider; лишний wrapper удалён, настройка включения ранжирования сохранена.

Исправлен подтверждённый дефект локального TF-IDF: при пустом каталоге, запросе без совпадений или отмене массив ranking был пустым, а обращение к [0].score выбрасывало TypeError. Сейчас возвращается пустой результат. Удалён пункт ExP Assigned из dropdown фильтров настроек; Advanced, статический Experimental и остальные фильтры сохранены, parser/API не менялись.

Проверки: 86 browser Mocha tests passed (7 новых поиска, 78 существующих SettingsTree и обновлённый dropdown test), 0 page errors. Проверены exact key match, выключение локального ranking, поиск описания без AI service, три пустых результата и отсутствие AI provider, сохранение Advanced toggle/остальных фильтров. Scoped TypeScript четырёх файлов — 0 diagnostics; ESLint четырёх файлов и git diff --check прошли. На старом preferencesSearch.ts из 41c46a51f99 новые тесты дали ровно четыре ожидаемых failures: AI DI и три настоящих TypeError по пустому ranking; остальные три сценария прошли.

Wiring не требуется. ai-search-services-disable меняет другой слой и интегрируется независимо. Общие settings configuration entrypoints, extension host, поиск файлов и символов не менялись. Полные typecheck/package/native выполняет интегратор на следующем пакете; текущий binary snapshot не расширялся.
