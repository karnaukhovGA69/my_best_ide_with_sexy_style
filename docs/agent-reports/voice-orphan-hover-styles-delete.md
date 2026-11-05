# voice-orphan-hover-styles-delete

Статус: ГОТОВО к интеграции в следующий срез. Код: `da08810bf0e`. Владелец: voice cleanup. Ветка: `agent/voice-orphan-hover-styles-delete`. База: `411cccde06e843fac42e170ccf749f7784c7f7e3` (toolbar/indicator/glow removal уже integrated).

A06: физически удалить orphan microphone hover helper/test и два CSS голосовой подсветки. До правок зарезервированы `src/vs/workbench/contrib/chat/browser/speechToText/micButtonHovers.ts`, `src/vs/workbench/contrib/chat/test/browser/micButtonHovers.test.ts`, `src/vs/workbench/contrib/chat/browser/speechToText/media/dictationMicGlow.css`, `src/vs/workbench/contrib/chat/browser/voiceClient/media/voiceGlow.css` и этот отчёт. Caller/reference scan подтверждает отсутствие production imports; helper используется только своим obsolete test. Shared entrypoints/build/common UI/auth/Git/SSH/history и чужие задачи исключены. Работа готовится отдельно от уже frozen release batch.

Удалены четыре orphan файла, 472 строки: backend-description hover helper и его obsolete tests, dictationMicGlow.css/voiceGlow.css. Рабочие consumers уже удалены/отключены в integrated toolbar/indicator/glow задачах.

Проверки: main ancestry `4cdcb3e4ab3`, `462fbc26408`, `72d954cada7` подтверждена; reference scan module paths и exported helper names после удаления — 0; git diff --check passed. Runtime не менялся; повторные browser/typecheck/full build не запускались. Не создавать новый release ради этого удаления; включить в следующий согласованный пакет.

Интегратору: код и отчёт с ветки. Нужные runtime prerequisites уже в базе. Никаких изменений frozen package/main/build/common UI/auth/Git/SSH/history не делалось. Общие feature entrypoints остаются отдельной областью интегратора.
