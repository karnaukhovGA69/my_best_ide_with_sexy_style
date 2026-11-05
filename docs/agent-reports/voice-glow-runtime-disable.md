# voice-glow-runtime-disable

Статус: ГОТОВО к интеграции. Код и тесты: `462fbc26408`. Владелец: voice cleanup. Ветка: `agent/voice-glow-runtime-disable`. База: `98aa2b043b141e7b4cc74d8f8d5e38da41bf68d7`.

A06: убрать оставшийся voice glow controller/rim DOM, CSS animation и fade timers, включая прямого caller chatViewPane. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/voiceClient/voiceGlowController.ts`, `src/vs/workbench/contrib/chat/test/browser/voiceClient/voiceGlow.test.ts` и этот отчёт. Сохранить pure color helpers/tests и API/types factories. Shared entrypoints/chatViewPane, GitHub/auth/Git/SSH, common API, настройки/история и чужие задачи исключены.

Удалены mounted layers, transitions, CSS/Web Animations, DOM/style mutations, theme callbacks и fade cleanup timers. Factories сохраняют interfaces, возвращая независимые неактивные objects; методы ничего не читают/меняют. Pure color/intensity helpers остаются в voiceGlow.ts, их 5 существующих тестов сохранены.

Проверки: 7 browser tests passed; targeted ESLint 2 файлов passed; semantic/syntactic TypeScript 2 файлов — 0; git diff --check passed. Проверены unreadable DOM/colors/callbacks, все lifecycle methods, repeated dispose, unchanged host, отсутствие RAF/Web Animations/timers. ESBuild/Playwright runner; без full/native build; зависимости неизменны.

Интегратору: `462fbc26408` и отчёт. Прямой caller chatViewPane автоматически получает inert controller; fixture voiceGlow становится намеренно пустой. Общий input/keyboard smoke пакетный. Shared entrypoints/chatViewPane/CSS/assets, GitHub/auth/Git/SSH/common API/main/build не менялись.
