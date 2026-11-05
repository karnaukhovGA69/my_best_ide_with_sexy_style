# external-terminal-menu

Статус: ГОТОВО к интеграции следующего пакета. Ветка: agent/external-terminal-menu. База: main b73001809cd. Владелец: чат упрощения Myself IDE.

Добавлен пункт Open New External Terminal в видимое меню Terminal, рядом с созданием встроенного терминала. Существующие команда и клавиши сохранены. Свежий single-folder workspace используется даже без записи в истории. Удалённый файл ищется отдельно от локальной истории; его локальный canonical URI преобразуется в каталог файла. Разрешение remote URI и запуск отделены: ошибки разрешения допускают прежний fallback, ошибки запуска возвращаются вызывающей команде, повторного запуска в домашней папке нет. Все ветки ожидают Promise платформенного сервиса.

Изменены только native contribution и его тест. Platform spawn, встроенный terminal/Tasks, Git/SSH и terminal dictation не менялись. Дополнительный wiring не нужен: native contribution уже подключён.

Проверки: 16 browser Mocha tests passed в headless Chromium, 0 page errors; 5 существующих сценариев и 11 новых (меню, свежая папка, canonical root/file, resolver failure, remote-only fallback и ожидание/ошибка запуска для пяти вариантов cwd). Узкая TypeScript-проверка двух файлов: 0 diagnostics. ESLint двух файлов и git diff --check прошли. Три выбранных regression tests с прежним production-файлом b73001809cd дали ровно три ожидаемых assertion failures, без page errors; рабочие файлы для baseline не менялись.

Ограничения: автоматические тесты подменяют платформенный launcher; запуск реального Ghostty/Terminal.app и native меню требуют smoke общего пакета. Это внешняя интеграция существующего launcher, не встраивание Ghostty внутрь IDE. Текущий собираемый интегратором snapshot уже закрыт; задача предназначена следующему пакету. Полный build/package не запускался.
