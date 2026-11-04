# keyword-activation-disable

Статус: ГОТОВО к интеграции. Владелец: агент ранее legacy-voice-chat-disable. Ветка: `agent/keyword-activation-disable`. База: `59f0fde52ec` (main). Claim: `37b1f747729`. Код и тесты: `c49e42d6df2`.

До реализации закреплены keyword recognition region и связанные imports в `src/vs/workbench/contrib/chat/electron-browser/actions/voiceChatActions.ts`, новый `src/vs/workbench/contrib/chat/test/electron-browser/actions/keywordActivation.test.ts` и этот отчёт. Другие агенты эти области не занимали. Предыдущая собственная legacy-voice-chat-disable меняет другой участок того же runtime-файла; при интеграции сохранить оба результата.

## Результат

A06: удалены Hey Code recognition loop, создание cancellation sessions, dispatch голосовых команд, speech/config/agent listeners, динамическая регистрация keyword setting, statusbar entry и команда `keywordActivation.status.command`. Старые значения настройки больше не активируют этот contribution.

Экспортируемый `KeywordActivationContribution` оставлен как явно неактивный compatibility class с прежними ID и SETTINGS_VALUE. Он не запрашивает сервисы DI, не подписывается на события и не создаёт statusbar entry. Существующий общий entrypoint остаётся совместимым без изменения файла интегратора. Не удалены общий speech API, read-aloud, другие voice action classes и theme participant.

## Проверки

- Browser Mocha: новый keywordActivation suite (5 тестов) и существующий voiceChatActions suite (1 тест) — **6 tests, 6 passed**, включая disposable tracking.
- Проверены создание через strict DI без speech/workbench services, все четыре сохранённых активных значения настройки, переходы off/on, dispose/recreate, отсутствие configuration listeners, добавленной schema и status command.
- Targeted ESLint для runtime и нового теста — passed.
- TypeScript semantic/syntactic diagnostics только двух изменённых файлов с ambient declarations — 0 diagnostics. Это не full-project typecheck.
- Контроль чувствительности: прежний runtime подставлен через esbuild loader без изменения checkout; все 5 новых тестов ожидаемо падают на прежней обязательной зависимости speechService, старый parser test проходит. Реальный микрофон и сеть в этом контроле не запускались.
- `git diff --check` — passed. `git diff 59f0fde52ec 88fe7140adb -- src/vs/workbench/contrib/chat/electron-browser/actions/voiceChatActions.ts | git apply --check` — passed на текущем дереве: предыдущий собственный caller cleanup patch применяется без конфликтов. Это проверка применимости, не совместный runtime smoke.

Для тестов использованы отдельный esbuild bundle во временном каталоге вне репозитория и headless Chromium из уже установленного Playwright; CSS/assets stubbed. Официальный Electron runner и native smoke не запускались. Переиспользованы собственные node_modules, зависимости не менялись; установленный pnpm 11.25.0 отличается от packageManager 12.16.0 и предупреждает о неизвестном workspace setting skills.

## Интегратору

Перенести код `c49e42d6df2` и отчёт с ветки. Entry point `src/vs/workbench/contrib/chat/electron-browser/chat.contribution.ts` уже импортирует/регистрирует совместимый класс; дополнительных подключений не требуется. Удаление самого import/registration и оставшейся общей setting-константы можно выполнить отдельно в общем entrypoint cleanup.

Сохранить также изменения `88fe7140adb` из legacy-voice-chat-disable в другом участке voiceChatActions.ts: export VoiceChatSessions и cleanup при отклонении createVoiceChatSession. Не заменять файл целиком версией одной из веток. Остальные ранее подготовленные voice/dictation/playback patches независимы.

На общем output выполнить `scripts/test.sh --run vs/workbench/contrib/chat/test/electron-browser/actions/keywordActivation.test.js` и соответствующий voiceChatActions suite; общие DI/startup/typecheck и native smoke включить в пакет релиза. Проверить отсутствие Hey Code settings/status entry и запуска распознавания при старом включённом setting.

MCP, documents/PDF, Terminal/Tasks, пользовательские настройки, auth, build/dependencies и main не менялись. Полное удаление голоса/AI и отсутствие микрофона/сети по другим путям не заявляются. Полной сборки, упаковки и нового бинарного релиза нет.
