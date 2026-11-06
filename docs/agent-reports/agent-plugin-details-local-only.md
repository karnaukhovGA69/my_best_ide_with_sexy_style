# agent-plugin-details-local-only

Статус: ГОТОВО к интеграции. Владелец: voice cleanup. Ветка: agent/agent-plugin-details-local-only. База: 3c442d9f9c059846f1327927c348f34f2f9c0e73.

Область: chat/browser/aiCustomization/embeddedAgentPluginDetail.ts; chat/browser/agentPluginEditor/agentPluginEditor.ts; новый chat/browser/agentPluginEditor/pluginReadme.ts; chat/test/browser/aiCustomization/embeddedAgentPluginDetail.test.ts; этот отчёт. Только README loading/rendering policy и source contribution loading: локальное чтение вместо HTTP/clone, CSP без внешних медиа. Сохранить installed data/ручную установку и ссылки; общие Markdown/auth/Git API не менять.

Реализация: 69a54b323a7. Общий local README loader используется обеими карточками; IRequestService DI и HTTP logic удалены. Remote/provider/UNC README пропускаются без чтения. Contribution preview больше не клонирует источник и читает только локальные URI; отсутствующий источник не устанавливается автоматически. Embedded Markdown запрещает remote media через sanitizerConfig; webview CSP разрешает только data images, без сетевых media. Ручные ссылки/install сохранены.

Проверки: 11 browser tests без failures/page errors; lint четырёх файлов и выбранные TS diagnostics без ошибок; diff --check пройден. Проверены local README/base URI, remote/provider absence, missing file и ошибки доступа, локальные contributions без clone. После browser run исправлено размещение sanitizerConfig и unused import, повторены lint/types. Native webview/CSP smoke и общая сборка — интегратор; layout/CSP native тестами этого задания не подтверждались.
