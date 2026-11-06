# model-picker-tryout-disable

Статус: ЗАНЯТО. Владелец: voice cleanup. Ветка: agent/model-picker-tryout-disable. База: 8a9f66bc9af61dfa3a8e4648fd1989392f79a2d4.

A06: снять model/provider tryout registration/payload. Область: src/vs/workbench/contrib/chat/browser/onboarding/modelPickerTryout.contribution.ts и src/vs/workbench/contrib/chat/test/browser/onboarding/modelPickerTryout.test.ts, этот отчёт. Module остаётся инертным для Sessions side-effect import. Shared onboarding registry/entrypoints/constants/GitHub authorization не меняются. createModelPickerTryout имеет consumers только внутри этих 2 файлов.
