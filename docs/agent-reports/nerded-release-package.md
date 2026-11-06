# nerded-release-package

Статус: **ГОТОВО К ПУБЛИКАЦИИ координатором**. Владелец package/QA: интегратор. Все три обнаруженных release blocker исправлены и проверены. Итоговый source snapshot **3dbf0296716432e7d6e3d61196a71865ccb7ad7c**. Релизный tag должен указывать на этот исходный коммит, не на последующие docs-коммиты. Полный build/package и native GUI слот ОСВОБОЖДЁН, мои тестовые процессы закрыты.

## Готовые артефакты

В outputs рабочего каталога чата интегратора, рядом с сохранённым локальным 0.0.9:
- `Nerded-Code-v0.0.10-preview-macOS-arm64.zip` — **214959695 bytes**.
- SHA-256 **d03618e04243137ec4a0710f896ac7af63d42bca2b805b5a5aa456a92c9c9d82**; отдельный `.zip.sha256`.
- `Nerded-Code-v0.0.10-preview-qa.json` — результаты и ограничения без пользовательских путей.
- Подписанный `Nerded Code.app` находится в прежнем isolated integration package destination. Старый 0.0.9 snapshot/ZIP сохранён.

Предыдущие e132/f44/f13 candidates superseded, не публиковать их. Финальные ZIP/QA/checksum обновлены на 3db.

## Исправленные блокеры

1. Runtime extension registration больше не ищет gallery metadata автоматически; локальные runtime notifications и ручные gallery/update операции сохранены. 229 tests passed, 0 failures/pageErrors; typecheck/lint passed. Первоначальный development probe показал реальный Open VSX запрос; после исправления он отсутствует.
2. Иконки имеют filename/extension fallbacks и работают без языковых registrations. Принят 6563c069472 (в main как f13eaacda3b). 8 resource tests повторены, 4 real-loader browser tests агента переиспользованы. В native чистом профиле без Go/JSON/Rust расширений визуально подтверждены их цветные значки. Maintainer scripts/tests исключены из пакета.
3. Переименование больше не меняет default user-data root: optional `product.userDataFolderName = Myself IDE` согласованно используется ранним Electron bootstrap и NativeEnvironmentService. Видимое имя Nerded Code сохранено, fallback для других products и portable/appdata/CLI/dev приоритеты сохранены. 9 node tests, scoped lint и final full client typecheck passed. **На окончательном пакете запуск БЕЗ --user-data-dir реально открыл state.vscdb прежнего профиля, не открыл новый branded root; существующий settings.json побайтно не изменился.** Каталоги не перемещались, не объединялись и не удалялись. Для этой проверки использованы отдельные extensions/shared storage и безопасный workspace.

## Проверки готового пакета

Production bundle/package на source 3db завершён. Ad-hoc signing и `codesign --verify --deep --strict` passed; это НЕ notarization. Post-sign build-path guard passed. ASAR: 4484 packed + 32 unpacked записи сверены после подписи. Все 4306 documentation SHA совпали, 1664 SVG присутствуют. Итоговый ZIP: CRC/path checks passed, **8091 entries** сверены с подписанным app.

На окончательном 3db binary с явным изолированным профилем: Workspace Trust enabled; workspace.isTrusted=false; 0 automatic terminals/tasks; оба malicious-fixture marker-файла отсутствуют; Effective Go открыт. Chromium netlog startup/idle/reader: **0 URL/TCP/DNS requests**; socket snapshot девяти процессов пуст. Ранее на f13 дополнительно три снимка девяти процессов и полный цикл settings import/export/docs не показали сети. Это наблюдение, не OS network sandbox и не гарантия за произвольные сторонние расширения.

Native f13 GUI: Restricted Mode, Calmer flush UI, цветные icons без языков, библиотека через видимое View menu, полноценный текст Effective Go рядом с кодом. Settings: preview не изменяет профиль; explicit Apply переносит fontSize=17/tabSize=3, синтетический github.accessToken исключён; exported JSON содержит применённые значения без секрета. Native f44: Git, zsh/bash, Tasks exit0, completion, manual formatter, VSIX install 0.0.1 → update 0.0.2 → uninstall, documents undo/redo/save/reopen/external change passed. Реальный packaged PDF command/system Save dialog создал PDF, Poppler PNG визуально проверен (кириллица, латиница и буквальная HTML-строка). Соответствующий feature code после этих проверок не менялся; повторены затронутые branding/profile/packaging/trust/network проверки, а не весь успешный цикл без причины.

Логи и test artifacts: work/nerded-release в рабочем каталоге чата интегратора. Финальные файлы: package-profile-final.log, sign-profile-final.log, package-audit.json, zip-audit.json, default-profile-native-result.json, profile-final-network-result.json, profile-final-process-network.json, settings-native-result.json.

## Передача координатору

release-install-telegram остаётся владельцем публикации GitHub, metadata, установки, реальных публичных screenshots и Telegram text/images (не отправки поста). Можно устанавливать проверенный app и публиковать v0.0.10-preview с tag на **3dbf0296716**. Финальные screenshots 1440×900/1024×768 делать на безопасном demo project; HW1_KPO и QA-профили не публиковать. После profile-path fix обычный запуск сохраняет старый профиль; каталог нового candidate Nerded Code оставлен нетронутым, автоматической миграции его настроек нет.

Ограничения: macOS ARM64, ad-hoc без notarization; языковые grammar extensions пользователя установлены отдельно координатором, публичный allowlist не расширялся; GitHub login/catalog приложения и Remote SSH/server остаются отложенными. Полное стирание AI/shared API и завершение всего долгосрочного плана не заявляются. Новых feature-правок в этот frozen package не добавлять; новый конкретный blocker означает отдельное адресное исправление и повтор затронутых проверок.
