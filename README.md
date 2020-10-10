# Веб-расширение Chrome для настройки виртуальных устройств

## Принцип работы

При раскрытии попапа забирает из localStorage ключи с определенным префиксом.

На основе json из localStorage и `src/ui/settings.json` собирает контролы для настройки.

Если у какого-то поля не указан тип - выводит из существующих данных.

TODO: `null` строка распознается как тип null.

## Settings.json

`schemas` содержит описания настроект устройств - типы полей + служебная информация.

Поля с названиями с `__` - служебные, для настроек расширения.

TODO: Поле `version` только для чтения и индикации, актуальны ли настройки.

`nullable` - поле можно занулить.

`deletable` - поле можно удалить. Актуально для эмуляции ошибок.

## Development Info

На базе [boilerplate](https://github.com/duo-labs/chrome-extension-boilerplate).

Иконки из [feather](https://github.com/feathericons/feather).

Главная иконка с [pngrepo.com](https://www.pngrepo.com/svg/149500/programming)
