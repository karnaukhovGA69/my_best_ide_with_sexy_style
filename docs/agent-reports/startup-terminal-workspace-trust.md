# startup-terminal-workspace-trust

Статус: ЗАНЯТО. Владелец: интегратор/documents agent. База: main bb3be563557. Область: welcomeGettingStarted/browser/startupPage.ts и test/browser/startupPage.test.ts, этот отчёт. Автоматический startup terminal должен дождаться инициализации Workspace Trust и не вызывать terminal command в untrusted workspace. Существующие terminal process gates и ручные действия не менять; README сохраняется. Проверки trusted/untrusted/delayed initialization и пакетная типизация; native trust smoke отдельно.
