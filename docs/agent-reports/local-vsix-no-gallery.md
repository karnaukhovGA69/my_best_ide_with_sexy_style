# local-vsix-no-gallery — установка локального VSIX

Статус — готово к независимому ревью [#16](https://github.com/karnaukhovGA69/my_best_ide_with_sexy_style/issues/16). База `8c5155c82de`, ветка `agent/local-vsix-no-gallery`.

## Поведение и затронутые места

До правки штатный установщик после записи локального VSIX в профиль искал его ID и версию в Open VSX. При отсутствии совпадения он повторял запрос только по ID. Панель расширений дополнительно сопоставляла установленное расширение с каталогом. Теперь установка автономного локального VSIX через CLI или панель расширений не инициирует эти запросы. Панель показывает расширение и его состояние, используя уже доступные сведения о политиках.

- `src/vs/platform/extensionManagement/common/extensionManagement.ts` и `node/extensionManagementService.ts` передают через существующий контекст установки один признак локального файла. Для VSIX, скачанного по URL, события по-прежнему содержат временный путь. Обогащение метаданных такого пакета и объявленные зависимости сохраняют прежний путь выполнения.
- `src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts` обновляет список и состояние локального VSIX из события установки и использует последний загруженный control manifest. В смешанном событии остальные расширения продолжают обновлять сведения из галереи. События без исходного URI используют сохранённый тип установки, события без контекста с URI используют его схему.
- `src/vs/platform/extensionManagement/test/node/extensionManagementService.test.ts` устанавливает тестовый архив в отдельный профиль через реальный файловый сервис и проверяет локальный пакет, зависимость и скачивание по URL с сохранением временного пути в событии.
- `src/vs/workbench/contrib/extensions/test/electron-browser/extensionsWorkbenchService.test.ts` покрывает установку через сервис панели, обновление списка, сохранение сведений о политике и смешанное событие с локальным VSIX, скачанным VSIX и расширением из галереи.

Установка автономного локального VSIX проверяет манифест, совместимость и allowlist без предварительного запроса control manifest. При установке зависимостей из галереи действуют прежние проверки, включая проверку подписи. Периодический запрос списка вредоносных расширений остаётся отдельным механизмом `extensionEnablementService.ts`. Явная проверка обновлений и использование галереи имеют прежнее поведение.

## Проверки

- На исходной базе два теста Node упали из-за лишних запросов к галерее. Тест Electron показал один лишний поиск при успешной установке. После правки три сценария Node и обе проверки Electron прошли.
- На macOS ARM64 прошли 181 проверка платформы Extension Management и 232 проверки Electron для Extensions Workbench. В широком прогоне существующие тесты кэша сканера выводили `Canceled`, итоговый код выхода — 0. Целевой TypeScript, ESLint пяти TS-файлов и `git diff --check` прошли.
- CLI с обновлённым текстом сервисов установил `myself.offline-documentation@0.1.0` в новый временный профиль при `sandbox-exec` с `deny network*`. `--list-extensions --show-versions` подтвердил установку, в каталоге профиля появился `documentation/catalog.json`. В trace установки отсутствовали `extensionquery` и вызов получения control manifest. Использован существующий dev Electron и адресная транспиляция.
- Полная упаковка приложения и ручная проверка меню в окне IDE ожидают интеграционного кандидата.

## Повторение проверок

После транспиляции изменённых TS через esbuild с `--outbase=src --outdir=out --format=esm --target=es2024` запустить из рабочего каталога. `electron_binary` — путь к исполняемому файлу dev Electron.

```sh
ELECTRON_RUN_AS_NODE=1 "$electron_binary" node_modules/mocha/bin/mocha.js test/unit/node/index.js --delay --ui=tdd --exit --runGlob 'vs/platform/extensionManagement/test/{node,common}/*.test.js'
"$electron_binary" test/unit/electron/index.js --run src/vs/workbench/contrib/extensions/test/electron-browser/extensionsWorkbenchService.test.ts
git diff --check
```

На интеграционном кандидате повторить установку того же VSIX через CLI и через **Extensions → … → Install from VSIX…** в двух отдельных профилях с сетевым trace. После старта каждого профиля снять фоновый trace для сравнения. При установке расширение должно появиться в списке и на диске. В trace установки не должно появиться запроса метаданных по ID VSIX. Отдельно повторить установку обычного расширения из галереи и локального тестового VSIX с объявленной зависимостью.
