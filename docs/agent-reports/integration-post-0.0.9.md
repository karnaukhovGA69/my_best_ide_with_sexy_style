# integration-post-0.0.9

Статус: ЗАНЯТО. Владелец: интегратор. Ветка: integration/post-0.0.9. Независимая интеграция следующего среза, пока UI-проверка release-0.0.9 остаётся открытой. Бинарник 0.0.9 из 41c46a51f99 сохранён отдельно; этот срез в него не входит. Main/общие entrypoints/совместимость — область интегратора. Полный package не запускается после каждой task-ветки.

Первый snapshot:
- `agent/dictation-orphan-language-delete` — `1e2e7d39697a3f192e1ff9620cfbedcc6a12476c`
- `agent/inline-completions-service-disable` — `00c3c8e95653242752ba30a1344af07cf2184d54`
- `agent/inline-suggestion-settings-remove` — `f18339b13bb9ef35188dd3563be23c138b1da209`
- `agent/terminal-dictation-runtime-disable` — `7e1a78c56b60ced5a56472f002eb7036d492edd2`
- `agent/voice-instructions-actions-disable` — `f86b69a6a9374575bbf2f3f05ca80c8489444a21`
- `agent/voice-orphan-endpoint-delete` — `001095e977e1a1bed376071ab4d271700582a4b9`
- `agent/voice-orphan-hover-styles-delete` — `e61c3579a56ca34c09673614f4cbc41365377bde`
- `agent/voice-orphan-styles-delete` — `1626cf9ed9627e503eb9219545fdf491488011a4`

Первый срез объединён без конфликтов. 75 browser tests passed, 0 page errors; поиск runtime ссылок на удалённые voice helpers/styles чистый. Полный typecheck объединяется со следующим срезом, package не запускался.

Второй snapshot (ЗАНЯТО интегратором):
- `agent/ai-edit-telemetry-runtime-disable` — `a441bacdeb2a924ab079c9c633243fa4f0f5f6b4`
- `agent/ai-search-services-disable` — `48a0fc6440ac66b25aa6471655e6386293508e0e`
- `agent/edit-statistics-startup-disable` — `3162e9b572d37d717611858472061dbc42edfe57`
- `agent/editor-telemetry-forwarding-disable` — `663370182addf937e014a7cb5ef8a22d8b507e08`
- `agent/experimentation-service-runtime-disable` — `d3892382c8621fb70af645597ffd5e2c7f0cd865`
- `agent/external-terminal-menu` — `9e76c0f1199754155edb6b7e4c3e5213130150ec`
- `agent/settings-search-local-only` — `88811e83e8198b150c0ac2c1776ce4dacabc4d32`

Второй срез объединён без конфликтов; 131 browser tests passed, 0 page errors. Общий client typecheck для обоих срезов прошёл. Итого проверены 15 task snapshots (forwarding также входит как dependency AI-edit telemetry), 206 browser tests. Пакет передаётся в main без новой binary сборки; native external-terminal smoke остаётся проверкой следующего общего package. Release 0.0.9 остаётся отдельной незавершённой задачей.
