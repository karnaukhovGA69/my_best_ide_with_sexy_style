# voice-instructions-actions-disable

Статус: ГОТОВО к интеграции. Код и тесты: `d2af3c20791`. Владелец: voice cleanup. Ветка: `agent/voice-instructions-actions-disable`. База: `b73001809cd9f446176f09e81eef1a028f56ebf7`.

A06: убрать команды настройки voice/dictation instructions, picker/workspace/home reads и автоматическое создание instruction files. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/actions/configureVoiceInstructionsAction.ts`, `src/vs/workbench/contrib/chat/test/browser/actions/configureVoiceInstructionsAction.test.ts` и этот отчёт. Exported command IDs и registration function сохраняются. Пользовательские instruction files не читать/изменять/удалять. GitHub/auth/Git/SSH/common API, shared chat entrypoint и чужие задачи исключены.

Удалены voice/dictation instruction action classes/registration, workspace/home/trust/file-service reads, quick pick, создание folders/files и editor opening. Exported IDs и inert registerConfigureSpeechInstructionsActions сохранены. Существующие пользовательские instruction files не читались/не менялись.

Проверки: 1 browser regression passed — отсутствие обоих commands и изменений CommandPalette при повторной регистрации; targeted ESLint 2 файлов passed; semantic/syntactic TypeScript 2 файлов — 0; git diff --check passed. ESBuild/Playwright runner; без full/native build, зависимости неизменны.

Интегратору: код и отчёт с ветки. Shared chat contribution может пока вызывать inert function; убрать call/import при общей entrypoint cleanup. GitHub/auth/common API/Git/SSH/main/build и пользовательские данные не менялись.
