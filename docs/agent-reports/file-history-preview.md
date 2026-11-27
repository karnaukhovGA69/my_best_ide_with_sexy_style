# История текущего файла с предварительным сравнением

Task ID `file-history-preview`, очередь 11. База `e1d30d017826f23b582334df6d3e6606449bc021`, ветка `codex/file-history-preview`. Изменены только новый `src/vs/workbench/contrib/myselfFileHistory/**` и этот отчёт.

## Пользовательский путь

В заголовке Files и обычного редактора локального файла добавлено компактное подменю Current File History. Оно действует по текущему открытому файлу. Фокус другого файла в дереве и переданные вручную аргументы не меняют цель. Отдельный штатный Open Timeline выбранного элемента дерева остаётся доступен в его контекстном меню.

- Open File Timeline передаёт текущий URI в штатный `files.openTimeline`. Timeline отображает доступных провайдеров Git и локальной истории.
- Preview Local History… предлагает сохранённые версии именно этого файла. Выбор передаётся в штатный `workbench.action.localHistory.compareWithFile` и открывает настоящий diff. Отмена завершает действие.
- В активном diff локальной истории появляется Restore Previewed Local Version…. Действие заново проверяет принадлежность записи и вызывает `workbench.action.localHistory.restore`. Восстановление требует штатного подтверждения с предупреждением о потере несохранённых изменений.

Восстановление этой кнопкой относится к локальной истории. Git-история просматривается штатными действиями Timeline, включая сравнение Git-версий. Штатный Restore Contents в контекстном меню Timeline также предлагает свой прямой путь к подтверждению. Новый путь предварительного сравнения предоставлен отдельными действиями.

## Проверенная исходная реализация

`timeline/browser/timeline.contribution.ts` регистрирует `files.openTimeline` с разрешением resource/focus/active editor. Новый вызов передаёт URI явно. `localHistoryTimeline.ts` назначает элементу истории штатное открытие diff. `localHistoryCommands.ts` реализует compareWithFile через повторный поиск записи и открытие diff. Его restoreViaEditor виден при primary scheme `vscode-local-history`. В стандартном diff history→file первичный ресурс имеет scheme `file`, поэтому потребовалось отдельное действие в заголовке diff. `restore()` повторно находит запись и запрашивает подтверждение до revert/clone.

## Границы реализации

Все новые действия работают с активным обычным локальным `file:` редактором или с проверенным активным `DiffEditorInput`. Remote/custom/UNC/untitled не используются для чтения локальной истории. Источник целевого ресурса задаётся активным редактором. Первый workspace root и внешние аргументы не выбирают файл.

Согласованный contribution-local контекст `myselfFileHistoryHasPreview` зарегистрирован через существующий `IEditorGroupsService.registerContextKeyProvider`. Он истинен только для активной группы и её текущего проверенного preview. Совпадение одного EditorInput в двух группах само по себе не включает кнопку в неактивной группе. Пассивные события отслеживают активацию группы, смену input, подписи/ресурса и закрытие. История и файловые провайдеры при этом не читаются. При disposal значения во всех группах сбрасываются до снятия регистрации, слушатели освобождаются.

Перед restore проверяются настоящий active DiffEditorInput, original `vscode-local-history`, локальные location/associatedResource/modified, сопоставление associatedResource и modified через `IUriIdentityService.extUri`. Невалидный JSON descriptor отклоняется до чтения истории. После getEntries должны совпасть entry.id, entry.location и entry.workingCopy.resource. Затем повторно проверяются активная группа, input и оба URI. Переданный штатным EditorTitle groupId используется только для отказа при несовпадении с активной группой, цель по нему не выбирается. Такая же проверка действует для History/Preview. Недоступная запись даёт информационное сообщение. Одновременные повторные вызовы для одного целевого файла подавляются до завершения штатного действия, в том числе при открытом подтверждении. Ошибка освобождает защиту для повторной попытки.

Ручные чтение и восстановление локальной истории доступны в Restricted Mode по штатному контракту. Git сохраняет собственные ограничения Workspace Trust. Новый код не использует API записи/clone/revert, Git index, сеть или собственное хранилище. Штатное восстановление владеет записью, обработкой dirty working copies, ошибками и добавлением восстановленной версии в локальную историю.

## Проверки

Прошли 30 unit-тестов в узком esbuild-бандле с настоящими Registry, InstantiationService, EditorInput, DiffEditorInput и LocalHistoryFileSystemProvider. Покрыты точный active URI при одинаковых basename в разных корнях, игнорирование аргументов, сортировка и выбор версии, disabled/empty/cancel, remote/custom/UNC и отсутствующий файл, недоверенные JSON descriptors, foreign location/resource/id, обычный/Git/reversed diff, смена active input/original/modified во время чтения, двойной клик, ошибки и освобождение защиты, пассивный context/disposal, две группы с обычным/историческим input, один diff в двух группах, смена группы с тем же input и отклонение устаревшего EditorTitle groupId.

Целевая синтаксическая и семантическая проверка TypeScript двух новых файлов дала 0 диагностик. ESLint дал 0 ошибок и три предупреждения при использовании общего config другого checkout — Missing definition `code-import-patterns` для двух файлов и напоминание о `i18n.resources.json`. Интегратор проверяет их в объединённом checkout. `git diff --check` прошёл.

Дополнительный одноразовый стенд исполнил точные исходные функции restore/findLocalHistoryEntry из существующего localHistoryCommands.ts с подменами сервисов. Отмена native confirm дала 0 записей/revert. При подтверждении проверен порядок soft revert → clone → force revert → открытие целевого файла → запись штатной истории → закрытие источника. Это сервисный тест без реальной файловой системы. В unit-тестах нового contribution штатные compare/restore команды подменены, реальная маршрутизация UI предстоит в общем пакете.

## Исправление split editor

Исходная версия `19c3a11be66` использовала общий ключ видимости. Прослежено, что action-bar click в `EditorGroupView` не активирует группу, а EditorTitle использует scoped context. QA воспроизвёл отдельным source-derived regression — 26 исходных тестов прошли, новый тест упал. Restore был видим в чужом заголовке и мог отправить восстановление активного preview с правильным штатным подтверждением. Финальная версия использует group context provider и дополнительный runtime veto groupId. Регрессионные проверки требуют скрытия в неактивных группах, обновления обеих групп при переключении и нуля history/command calls от такого заголовка.

## Подключение и воспроизведение

Интегратор добавляет desktop import `./contrib/myselfFileHistory/browser/fileHistory.contribution.js` и запись `vs/workbench/contrib/myselfFileHistory` в `build/lib/i18n.resources.json`. Общие entrypoints и реестр локализации принадлежат интегратору. Новых сервисных регистраций нет, используются существующие DI и menu API. Полная сборка и окна IDE в этой задаче не запускались.

Для лёгкого повтора тестов из корня своего checkout задайте `TOOLS_ROOT` на checkout с установленными закреплёнными esbuild/mocha.

```sh
node --input-type=commonjs <<'JS'
const path = require('node:path');
const { createRequire } = require('node:module');
const tools = createRequire(path.join(process.env.TOOLS_ROOT, 'package.json'));
const output = '.build/file-history-preview/tests.cjs';
tools('esbuild').buildSync({
  entryPoints: ['src/vs/workbench/contrib/myselfFileHistory/test/browser/fileHistory.test.ts'],
  bundle: true, platform: 'node', format: 'cjs', outfile: output,
  nodePaths: [path.join(process.env.TOOLS_ROOT, 'node_modules')],
});
const Mocha = tools('mocha');
const mocha = new Mocha({ ui: 'tdd' });
mocha.addFile(output);
mocha.run(failures => { process.exitCode = failures ? 1 : 0; });
JS
```

## Приёмка общего пакета

1. Сохранить несколько версий тестового файла, открыть Current File History → Preview Local History…, выбрать старую версию. Проверить реальный diff и отсутствие записи до отдельного восстановления.
2. Из заголовка diff вызвать Restore Previewed Local Version… и отменить предупреждение. Проверить сохранение файла и dirty-буфера. Повторить с подтверждением на тестовом файле и сверить штатную новую запись истории.
3. В multi-root проекте открыть файл второго корня с таким же basename, выделить другой файл в Files и вызвать историю из заголовка. Целью должен оставаться открытый файл второго корня.
4. Проверить отсутствие файла, пустую/выключенную историю, отмену picker, смену редактора пока picker открыт, удалённую запись и повторные клики восстановления.
5. В Timeline сверить доступные локальные/Git версии и штатные сравнения. Проверить режим Restricted без ослабления правил Git.
6. В split editor проверить скрытие Restore в неактивном обычном редакторе и в другом history diff, включая один и тот же input в двух группах. Проверить переключение групп, компактность заголовков, overflow, keyboard focus и локализацию.
