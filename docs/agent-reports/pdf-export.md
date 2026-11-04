# pdf-export

Статус: реализован и проверен интегратором. База: a797569144572629901e5bb6e97430251f86664c. Коммит реализации: c194d5fc0fdcf59621942ab3ba4ec5a33671cd29.

Область: platform/documentExport, workbench/contrib/documentExport; общие NativeHost, desktop entrypoint, тестовый NativeHost и i18n resource подключены интегратором. Зависимости не добавлены.

Готово: DTO v1, локальный Electron printToPDF, родительский Save Dialog, атомарная запись через временный файл, отмена, ограничение одного экспорта на окно, timeout и очистка renderer/session. HTML экранируется, JS/сеть/новые окна запрещены. Заголовок PDF фиксирован: Document, без текста документа в метаданных. Текст до 2 MiB UTF-8.

Команда для расширения: myself.documents.exportPdf(request), результат saved с URI либо cancelled. Видимая команда myself.documents.exportActiveTextPdf читает открытый текст, включая несохранённые изменения: File → Export Text as PDF, также кнопка в заголовке .txt. Параметры этой кнопки: A4, поля 20 mm, serif 12 pt, интервал 1.5.

Проверено на macOS ARM64: full client typecheck, целевой ESLint, 5 успешных node unit checks (включая harness), native Electron export/cancel/concurrency/write-error/cleanup. PDF на одну и шесть страниц: кириллица/английский, длинная строка, извлечение текста и визуальная проверка всех страниц. Через реальный UI packaged app: .txt → кнопка → Save Dialog → PDF; текст и внешний вид проверены. Production bundle/package и общий native smoke прошли.

Ограничения: обычный текст; Markdown/HTML остаются буквальным текстом. Нет DOCX, rich text и настроек страницы в пользовательском UI. Другие платформы не проверены. documents-ui свободен и может использовать уже подключённый DTO; не менять backend и общие файлы без интегратора.
