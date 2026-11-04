# Integration

Владелец: основной чат разработки Myself IDE. База: a797569144572629901e5bb6e97430251f86664c. Реализация pdf-export: c194d5fc0fdcf59621942ab3ba4ec5a33671cd29; интеграционная ветка integration/document-pdf.

PDF backend и wiring готовы. Проверены full client typecheck, targeted lint/unit tests, настоящий Electron export (1 и 6 страниц), кнопка и native Save Dialog, извлечение текста и визуальная раскладка. Общий packaged smoke: Git, zsh/bash, shell Tasks exit0, completion, ручной formatter, отсутствие format-on-save, ручной VSIX install/update/uninstall. Исходники runtime после этих проверок не менялись.

Окончательная упаковка/подпись, ZIP privacy audit и публикация выполняются интегратором для v0.0.7-preview. Общие файлы, main, сборка и релиз закреплены за ним. Подробные локальные логи и checksum не помещаются в репозиторий.

Свободны: documents-ui, ai-terminal-cleanup, mcp-audit. pdf-export завершён; второго владельца backend не запускать без нового задания. documents-ui использует уже работающий контракт v1. Остальные AI/MCP реализации этим этапом не удалялись.

При ручной проверке одно обычное окно осталось пустым; повторный запуск с изолированным профилем и fixture-файлом успешно открыл редактор и экспортировал PDF. Причина первого состояния не установлена; пользовательский профиль не сбрасывался. Полный автоматический smoke также прошёл на отдельном профиле.
