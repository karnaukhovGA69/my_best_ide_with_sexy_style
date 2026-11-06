# release-install-telegram

Статус: ЗАНЯТО. Владелец: чат локальной библиотеки / release coordinator. Ветка: agent/release-install-telegram. База: main 41c3dd005c4.

Новое прямое поручение владельца (6 ноября 2026) заменяет прежнее «не билд, а замержь»: проверить готовые/оставшиеся ветки, после завершения текущего согласованного пакета сделать релиз, изменить описание на GitHub, установить приложение пользователю, подготовить короткий текст Telegram и ОБЯЗАТЕЛЬНО реальные скриншоты IDE. Публикация релиза, изменение описания репозитория и установка явно разрешены. Публиковать Telegram-пост пользователь не просил: только текст и изображения.

Разделение: интегратор остаётся владельцем main, preset/layout подключения, общего production build/package, signing/privacy и обязательного native trust/no-idle-network smoke. Этот чат занимает GitHub metadata/release publication, установку готового проверенного пакета, реальные скриншоты и текст поста; изменяет только этот отчёт и собственные release/post artifacts. Не запускает второй full build/typecheck и не меняет общие product/build/UI. Просьба интегратору после завершения Calmer preset/layout выполнить ОДИН общий релизный цикл и указать commit, app/ZIP/checksums, smoke/подпись/privacy результаты и ограничения. Новый исходный пакет нужно зафиксировать; незавершённые новые задачи не добавлять во время упаковки без причины.

GitHub login/catalog приложения и Remote SSH/server остаются отложенными. Наличие исходников AI/shared API не позволяет обещать полное стирание всего AI-кода. История с личными идентификаторами отложена; не переписывать историю. Репозиторий origin проверен, upstream не используется.

Начальная сверка: main содержит 98 implementation задач после 0.0.9; theme/icons и app icon/visible product name объединены. agent/nerded-calm-layout готова (4f887b5228e), preset/layout сейчас проверяется интегратором. release-notes-local-only уже перенесена с исправлением, незамерженный ancestry не означает потерянный код. GitHub ветки и private history audit исключены. gh пока требует авторизацию; проверяется существующий credential route без вывода секретов.


Доступ для публикации ПРОВЕРЕН: существующий Git credential helper позволяет GitHub REST API; repo permissions admin/maintain/push=true. Секреты не выводились и не сохранялись, gh auth/settings не изменялись. Новая авторизация не нужна. Последний опубликованный tag v0.0.8-preview; 0.0.9 существовал только локально. Для общего пакета предлагается `v0.0.10-preview`, имя `Nerded Code 0.0.10 Preview`, macOS ARM64. Финальный tag должен указывать на фактически собранный source commit, не на позднейший docs SHA. Этот чат опубликует assets после успешного QA; второй publisher не нужен.

Подготовленное новое GitHub About description: Nerded Code — a local Code - OSS editor for macOS Apple Silicon. Calmer Studio UI, colorful file icons, offline Go/Rust/PostgreSQL/Bash/Linux docs, local PDF export and file-based settings transfer. Manual extension management; built-in AI UI and telemetry disabled.

План скриншотов: реальный упакованный/установленный Nerded Code с безопасным демонстрационным проектом (без пользовательских данных), общий editor/files/terminal и локальная документация рядом с кодом; 1440×900 и compact 1024×768 по визуальному ТЗ. Оригиналы PNG приложить к Telegram-тексту и релизу. Не выдавать HTML-макет за приложение. Установка сохраняет пользовательский профиль и прежнее приложение до проверки нового.
