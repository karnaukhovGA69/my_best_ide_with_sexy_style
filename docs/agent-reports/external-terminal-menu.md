# external-terminal-menu

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/external-terminal-menu. База: main b73001809cd.

Область: src/vs/workbench/contrib/externalTerminal/electron-browser/externalTerminal.contribution.ts, соответствующий existing test/electron-browser/externalTerminal.contribution.test.ts и этот отчёт. Добавить видимое меню внешнего терминала без Command Palette; исправить потерю Promise запуска и выбор cwd свежего single-folder workspace. Проверить выбор папки/cancel/remote canonical path/failure propagation. Внешний запуск уже существует в платформенном сервисе; embedding Ghostty не обещается. Platform spawn, встроенный terminal/Tasks и активная terminal dictation область другого агента не затрагиваются. Полные build/release не запускать.
