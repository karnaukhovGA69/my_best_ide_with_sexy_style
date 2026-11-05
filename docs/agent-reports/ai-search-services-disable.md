# ai-search-services-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/ai-search-services-disable. База: main 41c46a51f99.

Область: реализации Workbench services aiSettingsSearch/common/aiSettingsSearchService.ts, aiRelatedInformation/common/aiRelatedInformationService.ts, aiEmbeddingVector/common/aiEmbeddingVectorService.ts; существующий aiRelatedInformation/test/common/aiRelatedInformationService.test.ts и новые тесты двух остальных служб; этот отчёт. Удалить вызовы AI providers, хранение запросов/results, таймеры и DI logging; оставить interfaces/registration/disposable API, isEnabled=false. Settings search не стартует и возвращает null; explicit embedding/related-information API возвращает понятную ошибку unavailable вместо выдуманного результата. Общие extension host/API и обычный поиск настроек/символов не менять. Проверить main-thread consumers типами; общий build интегратору.
