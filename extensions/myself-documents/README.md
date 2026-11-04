# Myself Documents

Опциональный редактор `.txt` для учебных ответов и эссе. Ввод — обычный текст; разметка Markdown и HTML не интерпретируется. Текст хранится в `TextDocument`, изменения проходят через `WorkspaceEdit`, сохранение — через VS Code. Параметры страницы не записываются в `.txt`.

## Использование

- «Новый документ» доступен в меню создания файла и контекстном меню Explorer. Команда: `myself.documents.new`.
- «Открыть как документ» — кнопка заголовка `.txt`, контекстное меню Explorer и стандартное Open With. Команда: `myself.documents.open`, custom editor: `myself.documents.editor`.
- В редакторе видны Save, Undo, Redo, Text Editor и Export PDF. `Ctrl/Cmd+S` сохраняет, `Ctrl/Cmd+Z` и redo идут в историю документа; `Ctrl/Cmd+F` открывает встроенное поле поиска. Простой поиск без регулярных выражений, переход к следующему совпадению с начала после конца текста.
- A4, поля 10–30 мм, три семейства шрифтов, размер 10–24 пт, интервал 1–2. Макет приблизительный: это непрерывный лист, не точное разбиение на страницы PDF. В узком окне лист адаптируется по ширине.
- «Экспорт PDF» вызывает существующий `myself.documents.exportPdf` с DTO v1. Выбор пути, отмена, ограничения и рендеринг принадлежат backend. При отсутствии backend показано сообщение; успешный экспорт не имитируется. Экспорт включает последние изменения, даже если `.txt` ещё не сохранён.
- При внешнем изменении во время набора черновик остаётся на экране. Кнопки позволяют взять версию файла либо явно применить свой черновик. Неразрешённый конфликт блокирует сохранение/экспорт из панели. Промежуточный текст хранится в локальном webview state для восстановления при перезагрузке панели; это не формат переносимого документа и не отдельное резервное копирование.

Английские и русские подписи. Цвета следуют теме IDE, элементы имеют текстовые подписи и keyboard focus; анимаций нет. Ручная проверка со screen reader ещё требуется.

## Локальная сборка и тесты

Из корня форка, с его установленными зависимостями и версиями инструментов:

```sh
pnpm --dir extensions/myself-documents run compile
pnpm --dir extensions/myself-documents run test
```

Компилируются только host-код и webview этого расширения. Runtime-зависимостей нет. Тесты используют уже имеющиеся `node:test` и `@playwright/test`; Chromium должен быть установлен для Playwright. Новые package/lockfiles в корне не нужны. Исходники webview лежат в `webview/editor.ts`, результат — `out/webview/editor.js`; CSS находится в `media/editor.css`.

Unit/provider tests проверяют Unicode, LF/CRLF, minimal edit, DTO, cancellation/errors/missing backend, границы параметров и размера, stale edits, dispose и контракт document API. Browser tests исполняют настоящий HTML/JS/CSS с mock message bridge: быстрый ввод, acknowledgements, восстановление черновика, конфликты, поиск, параметры, буквальный HTML, keyboard undo, узкий viewport. Это не тест реального Save Dialog/PDF.

Дополнительный native test runner: `test/native/index.cts`. Запускать готовую Myself IDE с `--extensionDevelopmentPath=<repo>/extensions/myself-documents --extensionTestsPath=<repo>/extensions/myself-documents/test/native/index.cts`, отдельными короткими `--user-data-dir`/`--extensions-dir` и `--use-inmemory-secretstorage` для тестового профиля. Открыть пустую временную рабочую папку и передать её через `DOCUMENTS_NATIVE_FIXTURE`; тест создаст и удалит только собственную подпапку. Без открытой рабочей папки наблюдение внешнего изменения в текущей базе может не сработать за таймаут. `DOCUMENTS_NATIVE_RESULT` — необязательный путь локального короткого статуса теста. Не направлять эти переменные на пользовательские документы.

## Подключение в поставку: только integration

1. Добавить `myself-documents` в `distributionExtensions` в `build/lib/distributionExtensions.ts`; проверить соответствующие тесты allowlist.
2. Добавить `extensions/myself-documents/tsconfig.json` и `extensions/myself-documents/webview/tsconfig.json` в список `compilations` в `build/gulpfile.extensions.ts` либо эквивалентный целевой build hook, вызывающий `pnpm --dir extensions/myself-documents run compile`. Проверить именно наличие обоих JS entrypoints в упакованном расширении.
3. Сохранить `out/**`, `media/**`, `l10n/**`, `package.json`, `package.nls*.json`. `.vscodeignore` исключает исходники и тесты. Общий packaging код не менялся; итоговый package проверяет интегратор.
4. Backend v1 уже зарегистрирован; новых IPC, зависимостей или изменений `product.json` расширению не нужно. Desktop-only MVP: отдельного web-extension entrypoint нет.
5. В составе общего релизного пакета проверить пользовательский сценарий: New Document → ввод → Save As → reopen → undo/redo → PDF saved/cancel/error. Проверить реальные меню, CSP webview, загрузку локальных JS/CSS и русский язык, а также влияние host-команд Save/Undo на активную панель. Полную сборку ради отдельного изменения не запускать.

## Границы MVP

Rich text, DOCX, картинки, Markdown rendering, таблицы и перенос настроек страницы между устройствами не реализованы. Шрифты зависят от системы; preview не обещает идентичной PDF пагинации. Native-проверка выполнена на macOS; другие ОС, remote/virtual providers и screen readers ещё не проверены. Внешние изменения приходят через стандартное событие VS Code: расширение не перезаписывает файл и не запускает отдельный watcher/reload в обход document API. Файл вне открытой рабочей папки требует отдельной проверки host file watcher.
