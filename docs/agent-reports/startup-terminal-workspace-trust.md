# startup-terminal-workspace-trust

Статус: ГОТОВО, проверено и интегрировано. Владелец: интегратор/documents agent. База: main bb3be563557. Область: welcomeGettingStarted/browser/startupPage.ts и test/browser/startupPage.test.ts, этот отчёт. Автоматический startup terminal должен дождаться инициализации Workspace Trust и не вызывать terminal command в untrusted workspace. Существующие terminal process gates и ручные действия не менять; README сохраняется. Проверки trusted/untrusted/delayed initialization и пакетная типизация; native trust smoke отдельно.

Реализовано ожидание workspaceTrustInitialized и проверка isWorkspaceTrusted непосредственно перед startup terminal command. После ожидания повторно проверяется active editor, чтобы не заменить открытый пользователем документ. Ручной terminal process gate/allow-in-untrusted настройка не менялись; автоматический путь не обходит доверие. 14 browser tests passed, 0 page errors; scoped ESLint и diff --check passed. Общий DI typecheck следующего пакета и native untrusted smoke ещё впереди.

Общий client typecheck passed; combined startup/tasks suite 26 tests passed, 0 page errors. Интеграция выполнена в восемнадцатом срезе; native проверка нового пакета ещё впереди.
