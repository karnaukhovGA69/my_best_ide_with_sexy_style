# git-autofetch-disable

Статус: ЗАНЯТО. Владелец: чат упрощения Myself IDE. Ветка: agent/git-autofetch-disable. База: актуальный локальный main.

Область: extensions/git/src/autofetch.ts и точечные регрессии, при необходимости repository.ts только точки подключения AutoFetcher. Исключить автоматический fetch/предложение его включить независимо от импортированных git.autofetch настроек. Сохранить ручные Fetch/Pull/Push и Git/SSH команды терминала. Пакетные manifests/root и security/trust не менять. Целевые проверки extension TS/lint и отсутствие таймеров/подписок/вызовов fetch; общий пакет у интегратора.
