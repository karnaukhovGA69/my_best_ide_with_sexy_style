# nerded-calm-theme-icons

Статус: ЗАНЯТО. Владелец: visual implementation (бывший voice cleanup). Ветка: agent/nerded-calm-theme-icons. База: cfb88765d2317b09bb99bb9fa790929bccf7e3f2.

Источник требований: docs/agent-prompts/06-nerded-code-visual.md и docs/nerded-code-visual-spec.md, выбран Calmer Studio Original + цветные vscode-icons.

Точная область: новый каталог extensions/theme-nerded-calm/** — декларативный manifest/localization, тема, полный локальный icon-theme manifest и SVG assets, licenses/attribution/provenance, целевые resource tests; этот отчёт. Без activation/runtime JS, downloads или изменения пользовательских настроек. Общие product.json/build/allowlist/defaults/theme services/modernUI/layout и brand registration не менять: подключения передать интегратору. Не занимать nerded-calm-layout.

Проверки: palette/theme IDs, TextMate/semantic token colors, полный набор локальных icon references, case-sensitive/casefold-safe paths, отсутствие внешних ресурсов/активации; browser visual comparison с реальным Monaco/DOM и цветами темы, затем native smoke общего пакета интегратором. Включение в приложение и чистый профиль не объявлять выполненными до интеграции.
