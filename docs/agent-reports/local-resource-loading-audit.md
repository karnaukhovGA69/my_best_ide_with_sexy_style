# local-resource-loading-audit

Статус: АУДИТ ЗАВЕРШЁН; исправления перечисленных путей ещё не реализованы. Владелец: интегратор/documents agent. База: main be461ce2866. Область записи: только этот отчёт. Read-only аудит Markdown/media resource entrypoints и состава поставки; определить оставшиеся автоматические внешние загрузки и точные независимые scopes исправлений. release-notes-local-only, appearance-style-menu, GitHub auth/catalog и чужие кодовые claims не менять. Это аудит, не утверждение полного отсутствия сетевых запросов.

## Подтверждённые остаточные пути

- build/lib/distributionExtensions.ts включает markdown-language-features, markdown-math, mermaid-markdown-features и myself-documents. Поэтому обычный Markdown preview входит в пользовательскую поставку, это не только source-only код.
- extensions/markdown-language-features/src/preview/documentRenderer.ts: #getCsp разрешает https: для img/media/style/font даже в Strict; AllowInsecureContent добавляет http:, AllowScriptsAndAllContent возвращает пустой CSP. #fixHref сохраняет внешние HTTP(S) href для custom styles. Meta CSP используется при генерации preview HTML. Исправление должно ограничить subresource load во всех старых уровнях security, сохранив локальные ресурсы и ручные ссылки.
- extensions/markdown-language-features/src/preview/markdownEditorProvider.ts содержит отдельный CSP rich editor с img-src/media-src https:. Одного исправления documentRenderer недостаточно.
- src/vs/base/browser/markdownRenderer.ts: getDomSanitizerConfig разрешает http/https media и задаёт mediaSourceIsAllowed только при явном options.remoteImageIsAllowed. Editor sanitizer может вернуть undefined при allowedOrigins=true. Это отдельный путь hover/Markdown strings; нужен общий запрет внешних subresources с проверкой URI mapping, UNC, srcset/poster и сохранением local/remote-workspace files. Ручные anchor actions не запрещать.
- extensions/myself-documents/src/view.ts уже использует default-src none, img/connect/font none и локальные стили; эта проверка не доказывает безопасность остальных webviews или всего PDF backend.

## Предлагаемые независимые области исправления

1. Markdown preview/editor resources: extensions/markdown-language-features/src/preview/documentRenderer.ts, markdownEditorProvider.ts и собственные regression tests. До правок создать отдельный claim; release-notes-local-only не затрагивать.
2. Common Markdown media: src/vs/base/browser/markdownRenderer.ts, релевантные sanitizer/editor options и tests. Сначала проверить существующие local/custom scheme и remote workspace contracts. Нельзя заменять это глобальным запретом сети процессов.
3. Release notes остаются у текущего владельца. После трёх исправлений нужна пакетная native проверка локального Markdown с внешними img/video/style ссылками и сохранённых локальных ресурсов; статический аудит не заменяет runtime evidence отсутствия запросов.

Аудит read-only: без сетевых запросов, без запуска renderer/native smoke. Это список доказанных source-level разрешений и границ будущих проверок, не утверждение фактической утечки или полной изоляции. GitHub auth/catalog, пользовательские данные и сторонние расширения не менялись.

Последующее исправление: markdown-preview-local-resources ограничивает CSP обычного preview и rich editor; 2 browser network regressions passed. Common Markdown renderer и release notes остаются отдельными областями. Packaged native smoke ещё впереди; весь аудит не объявляется закрытым исправлением одного entrypoint.
