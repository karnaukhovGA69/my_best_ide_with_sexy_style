# nerded-icons-language-independent

Статус: ГОТОВО К ИНТЕГРАЦИИ, release blocker fix. Владелец: release coordinator. Ветка: agent/release-install-telegram, на базе main e1321795a25. Источник: прямое сообщение владельца при проверке candidate: отсутствуют .go/.json и многие другие файловые значки. Не публиковать старый e132 candidate.

Подтверждённая причина: upstream icon manifest хранил Go/JSON/Rust/многие другие mappings только в languageIds; language declarations удалены из минимальной поставки. Поэтому штатный getIconClasses возвращает только расширение, и выбирается generic icon. .md/специальные filenames/directories продолжали работать.

Исправлено в extensions/theme-nerded-calm: добавлены 277 недостающих fileExtensions и 40 fileNames из локальных деклараций с TextMate грамматиками; существующие специфические upstream mappings не перезаписываются. Light variants дополнены аналогично; SVG, исходные languageIds и графика не менялись. Maintainer script фиксирует добавления в provenance и исключён из поставки. Runtime code, языковые серверы, регистрации языков и автоматические скачивания не добавлены.

Проверки: 8 resource tests + 4 browser tests passed, 0 failures/page errors; scoped ESLint и diff --check passed. Browser regression использует настоящий getIconClasses и FileIconThemeLoader с отсутствующими language registrations/models; computed icon images проверены для .go (включая MAIN.GO), .json/.jsonc, .rs, .cpp, .fs, .lua, .sql, .sh, .yaml, .py, .ts/.js, .html/.css. Сохранены filename/light/folder overrides. Общий build/typecheck не запускался.

Интегратору: принять ветку после этого implementation commit (release coordinator report в ней также содержит новое поручение владельца), обновить release source snapshot, перепаковать изменённый extension через штатный package и повторить подпись/ASAR/privacy/затронутый native smoke. Проверить .go/.json на профиле БЕЗ языка. Старый source e132 tag не публиковать. Этот чат сохраняет владение GitHub publication/install/screenshots.

Пользователь уточнил: «моя тема» означает отсутствие цветной подсветки кода. Calmer UI в его окне уже применён; Go/JSON грамматики будут установлены отдельно в его пользовательский профиль, как предусмотрено разделением публичной поставки и личного набора. Это не причина возвращать языковые расширения в публичный allowlist.
