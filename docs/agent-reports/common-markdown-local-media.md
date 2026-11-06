# common-markdown-local-media

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/common-markdown-local-media. База: актуальный локальный main.

Область: src/vs/base/browser/markdownRenderer.ts и tests/browser/markdownRenderer.test.ts; при доказанной необходимости domSanitize.ts и его тесты, editor/browser/editorMarkdownSanitizer.ts и его тесты. Закрыть автоматические внешние subresources общего Markdown renderer, сохранив локальные файлы/remote workspace transport и ручные anchors. Проверить baseUri, URI mapping, UNC, srcset/poster и расширяющие options. Preview/rich editor и release notes принадлежат другим агентам; Git/SSH/network дочерних процессов и общие entrypoints не менять. Целевые браузерные regression tests, включая фактическое отсутствие внешних запросов, scoped TS/lint. Общий пакет/native — у интегратора.
