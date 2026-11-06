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

Третий snapshot (ЗАНЯТО интегратором): шесть MCP heads включают 11 implementation задач со своими зависимостями.
- `agent/mcp-orphan-connection-tasks-delete` — `f32b7e8956376bc786bc928c2243e91424ff8eb2`
- `agent/mcp-lifecycle-commands-remove` — `fc4896bf9f6404ef78d2881c89361a9a61066eb6`
- `agent/mcp-server-controls-runtime-remove` — `4098428f5c30f38828eaba472f57035e06d64c72`
- `agent/mcp-plugin-discovery-delete` — `f4d8aaf1bf50a87590c1228314aaededb44f22ab`
- `agent/mcp-server-editor-runtime-remove` — `5058199e010d71634a4a24daba2a0f83a4fe386a`
- `agent/mcp-configuration-form-delete` — `9de58123a971ee920e7bd2b69651f687dad49895`

Третий срез ЗАВЕРШЁН: шесть MCP heads (11 задач с dependencies) объединены без конфликтов. 112 browser tests passed, 0 page errors; полный client typecheck passed; git diff --check и source/import scan удалённых модулей чистые. Исходный коммит третьего среза: `379a3ea006742d50bcb2ef7806608fe1ff61e99c`. Все три среза: 26 implementation tasks, 318 browser tests в целевых наборах. Это исходная интеграция, не опубликованный бинарник.

Передача сборки: по новому прямому поручению пользователя package/build/sign/privacy/native и очистку слитых веток выполняет `build-and-branch-cleanup-2026-11-06` в worktree myself-mcp-audit. После попадания этого отчёта в main агент может зафиксировать main SHA и начать общий цикл; данный интегратор параллельный package не запускает. Старый неподтверждённый release-0.0.9 snapshot/бинарник сохраняется, не объявляется опубликованным или окончательно проверенным. `inline-rename-tracking-disable`, `voice-orphan-routing-delete` и активный `edit-telemetry-orphan-trackers-delete` не входят в переданный третий snapshot; принимать отдельным срезом, не менять уже выбранные builder inputs.

Четвёртый срез — ЗАНЯТО интегратором: inline rename tracking и orphan voice routing. Snapshot: `97645a419a4c851110eed8048c3c5e1e25d11b81`, `51875cd4ce41f8c0d28f2a61bc3712cfeb5d99e6`. Проверка и интеграция отдельно от зафиксированной сборки 379a3ea0067; builder inputs не расширяются.

Четвёртый срез расширен (ЗАНЯТО интегратором): own updater deletion `68f2343956a`; готовые `edit-telemetry-orphan-trackers-delete` = `d51bd61e22eeec6e52659e1d147fc66ceee0e136`, `inline-hover-orphan-delete` = `8c2e0d885a1763f932e30a4f09735dde5dceef49`, `voice-close-registry-delete` = `f8ed2e27669be2d7854cad5d826779eb3def900a`. Rename/Suggest 9 tests и retained updater 14 tests passed; общий typecheck этого среза ещё впереди, не запускать параллельно package другого агента.

Четвёртый срез: 40 целевых browser tests passed, 0 page errors. Полный client typecheck PASSED (exit 0); слот освобождён. Перед запуском активных package/typecheck процессов не было. Package не запускался.

Четвёртый срез ЗАВЕРШЁН: 6 задач, 40 browser tests без page errors, полный client typecheck и diff --check прошли. Разрешение относительных imports в 15050 TS sources src/build/test/extensions не нашло ссылок на 44 удалённых файла. Итого четыре среза: 32 implementation tasks, 358 целевых browser tests. Передача в main не расширяет builder snapshot 379a3ea0067; packaging documents fix ведёт build-and-branch-cleanup-2026-11-06.

Пятый срез — ЗАНЯТО интегратором: chat-pet-widget-runtime-disable `9a33161c9094ebc316d09aec4e57dede14a83ab0`, chat-pet-telemetry-remove `a783a0a903a9e6707fc271681d852e8ac566a75b`, editor-playground-orphan-delete `7bfe091ed5b07e84c94ea00711771d4d8eba5450`. Только source integration; сборка/packaging fix документов остаются за build-and-branch-cleanup-2026-11-06.

Пятый срез дополнен, ЗАНЯТО интегратором: survey-orphan-editor-delete `ad5cd2fb7888363e877a70b9f4f7e20b72389f6d`, model-feedback-survey-disable `a057e02a3db5731dc56b70b34d0e8f477056f176`, model-feedback-survey-ui-disable `518276a87e2dbd5b5b4efab690faa89796513efc`, harness-switch-survey-disable `aa307c01d1ac895caddab4fa254c99d53e07bc0f`.

Пятый срез: 18 целевых browser tests passed, 0 page errors. Полный client typecheck PASSED (exit 0), слот освобождён. Перед запуском активных package/typecheck процессов не было; package не запускался.

Пятый срез ЗАВЕРШЁН: 7 задач, 18 browser tests, 0 page errors, полный client typecheck и diff --check прошли. Scan 15041 TS sources не нашёл относительных imports 11 удалённых файлов. Итого пять срезов: 39 implementation tasks, 376 целевых browser tests. Полный старый ChatPetWidget suite не запускался: проверены только изменённые сценарии сервиса, отсутствие телеметрии и сохранность настроек. План разработки синхронизирован с текущим разделением source integration и binary build. Следующие задачи резервируются отдельно; готовность бинарного релиза не заявляется.

Шестой срез — ЗАНЯТО интегратором: model-survey-orphan-support-delete `fdf9751b5f19b2e67ced38b17d8c8870d04d3fbe` (включает widget-disable). Активная survey-orphan-config-delete пока не принимается. Сборка другого агента остаётся на собственном snapshot.

Шестой срез дополнен готовой survey-orphan-config-delete `6c95c88d515b0a9b60f156224e60fec48cd01095` — ЗАНЯТО интегратором. Own updater workbench cleanup `5b546644d97` также включён.

Шестой срез: полный client typecheck PASSED (exit 0), слот освобождён. Перед запуском активных package/typecheck процессов не было. Package не запускался.

Интегратор принимает готовое исправление packaging документов и отчёт сборки `aa520776d160109f1fa8ee43e8eb5a36a2912483`. ЗАНЯТО интеграцией. Исправление extension build не меняет client typecheck inputs; binary source остаётся 7e52ba804691ae05c9057b0b9815cab580efe7af.

Шестой срез ЗАВЕРШЁН: 4 cleanup задачи и исправление packaging документов объединены без конфликтов. 27 browser tests, 1 packaging regression test, полный client typecheck и diff --check passed. Relative-import scan удалённых файлов чистый. Итого шесть срезов: 44 implementation tasks (включая packaging fix), 403 целевых browser tests и 1 packaging test; повторные прогоны не суммируются. Локальный binary 7e52ba804691ae05c9057b0b9815cab580efe7af подтверждён отчётом владельца сборки, это не новый опубликованный релиз и не бинарник всех шести срезов.

Седьмой срез — ЗАНЯТО интегратором: готовый chat-tip-runtime-delete `ea554fcf17bde67182a31a6c4eac32b2e2ec74f9`. chat-tip-ui-delete пока активен и не принимается. GitHub-specific tasks исключены.

Седьмой срез: ЗАНЯТО интеграцией готового chat-tip-ui-delete `a1ebddc8bb96078e91b3d714f0944425e01d293f`; own post-update cleanup `290748c352e` включён.
