# text-size-menus

Статус: ГОТОВО к интеграции. Владелец: чат упрощения Myself IDE. Ветка: agent/text-size-menus. База: main 638bc19a1c8 + собственная готовая зависимость agent/appearance-style-menu 298b657810b.

Область: modernUI/browser/appearanceActions.ts, новый modernUI/browser/textSizeActions.ts и этот отчёт. Добавить видимые подменю размера текста редактора и терминала с существующими командами. Не менять движки масштабирования, настройки по умолчанию, общие entrypoints и чужие claims. Целевая проверка регистрации меню и lint; общий пакет/native проверяет интегратор.

Результат: View → Appearance → Editor Text Size и Terminal → Text Size содержат Increase/Decrease/Reset. Использованы существующие команды fontZoom, без изменения их поведения; редактор меняет временный EditorZoom, терминал — существующую настройку размера шрифта. Terminal подменю имеет существующий processSupported context. Масштаб окна и дефолты не менялись. Подключение через appearanceActions; дополнительный общий entrypoint не нужен. Нужна зависимость appearance-style-menu (уже включена в историю task-ветки).

Проверки: 6 существующих браузерных проверок appearance/layout density прошли; узкая проверка TypeScript четырёх файлов без диагностик; ESLint двух изменённых TS и git diff --check прошли. Для этой простой регистрации меню новые зеркальные тесты не добавлялись. Полная сборка и native/macOS меню остаются проверкой интеграционного пакета; отдельно не запускались.
