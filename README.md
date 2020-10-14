# Веб-расширение Chrome для настройки виртуальных устройств

[Ссылка на chrome webstore](https://chrome.google.com/webstore/detail/virtual-device-editor/mhjiccjdkciandldgagjgcekgdeiikpd?hl=ru&authuser=0)

## Принцип работы

При раскрытии попапа забирает из localStorage ключи с определенным префиксом.

На основе json из localStorage и [settings](./src/ui/settings.json) собирает контролы для настройки.

Если у какого-то поля не указан тип - выводит из существующих данных.

## Горячие клавиши

Ctrl+S - сохранить изменения

Ctrl+Z - сбросить изменения

## Settings.json

`schemas` содержит описания настроект устройств - типы полей + служебная информация.

Типы полей:
1. `string` - строка
2. `number` - число
3. `enum` - поле с ограниченным набором вариантов

Строка "null" считается как значение `null`. 

Поля с названиями с `__` - служебные, для настроек расширения.

`nullable` - поле можно занулить.

`deletable` - поле можно удалить. Актуально для эмуляции ошибок.

TODO: Поле `version` только для чтения и индикации, актуальны ли настройки.

## Development Info

На базе [boilerplate](https://github.com/duo-labs/chrome-extension-boilerplate).

Иконки из [feather](https://github.com/feathericons/feather).

Главная иконка с [pngrepo.com](https://www.pngrepo.com/svg/149500/programming)
