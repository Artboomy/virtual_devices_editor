import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../styles/popup.css';
import { ChangeEvent, RefObject } from 'react';
import ErrorBoundary from './errorBoundary';

import * as defaultSettings from './settings.json';
import IconButton from './iconButton';
import MainHeader from './mainHeader';
import { HotKeys, configure } from 'react-hotkeys';

type JsonObject = { [property: string]: Json };
type Json = string | number | boolean | null | JsonObject | Json[];

interface IState {
    hasChanges?: boolean;
    devices: Record<string, JsonObject>;
    originalDevice?: string;
    selectedDevice: string;
    settings: typeof defaultSettings;
}

type IEnumElement = { key: number; title: string };

function exportJson(obj: JsonObject, name: string): void {
    const blob = new Blob(['\uFEFF', JSON.stringify(obj, null, 4)], {
        type: 'text/plain;charset=UTF-8'
    });
    const link = document.createElement('a');
    document.body.append(link);
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    window.URL.revokeObjectURL(url);
}

interface IFullType {
    __nullable?: boolean;
    __deletable?: boolean;
    __type: string;
    __help?: string[];
    __readOnly?: boolean;
    __name?: string;
    __defaultValue?: string | number;
    __possibleValues?: string[];
    __enum?: Json[],
    __generics?: JsonObject;
}

class Main extends React.Component<Record<string, unknown>, IState> {
    private _tabId: number;
    private readonly fileInput: RefObject<HTMLInputElement>;
    private _isDeviceImport = false;
    private readonly _keyMap = {
        SAVE: 'ctrl+s',
        RESET: 'ctrl+z'
    };
    private readonly _keyHandlers: Record<string, (e?: KeyboardEvent) => void>;

    constructor(props: Record<string, unknown>) {
        super(props);
        this.fileInput = React.createRef();
        this.state = {
            hasChanges: false,
            devices: {},
            selectedDevice: 'None',
            settings: defaultSettings
        };
        chrome.storage.local.get(
            {
                settings: defaultSettings,
                selectedDevice: null
            },
            ({ settings }) => {
                this.setState({
                    settings: settings
                });
            }
        );
        this._keyHandlers = {
            SAVE: (e?: KeyboardEvent) => {
                e?.preventDefault();
                console.info('save', e);
                this._handleSaveDevice();
            },
            RESET: (e?: KeyboardEvent) => {
                e?.preventDefault();
                this._handleResetDevice();
            }
        };
        configure({ ignoreTags: [] });
    }

    private _getObjectPartByPath(
        obj: JsonObject,
        path: string
    ): { obj: JsonObject | undefined; path: string } {
        let newObj: JsonObject | undefined = obj;
        let newPath = path;
        if (path.includes('/')) {
            const parts = path.split('/');
            parts.forEach((part, idx) => {
                if (idx !== parts.length - 1) {
                    if (newObj) {
                        if (newObj[part] !== undefined) {
                            newObj = newObj[part] as JsonObject;
                        }
                    }
                } else {
                    newPath = part;
                    if (newObj && newObj[newPath] === undefined) {
                        if (newObj.__type === 'generic') {
                            newObj[newPath] = newObj.__generics ?
                                newObj.__generics[newPath] :
                                this.state.settings.generics[
                                    newObj.__name as string
                                    ];
                        }
                    }
                }
            });
        }
        return { obj: newObj, path: newPath };
    }

    private _beautifyKey(key: string): string {
        return key.replace(`${this.state.settings.prefix}`, '');
    }

    private _handleSelectedDeviceChange = (
        event: ChangeEvent<HTMLSelectElement>
    ) => {
        const selectedDevice = event.target.value;
        chrome.storage.local.set({ selectedDevice }, () => {
            this.setState({
                selectedDevice
            });
        });
    };

    private _handleValueChange = (fieldName: string) => (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const devices = this._getDevicesCopy();
        const { obj, path: fieldNameToChange } = this._getObjectPartByPath(
            devices[this.state.selectedDevice],
            fieldName
        );
        if (!obj) {
            return;
        }
        let typedValue;
        const type = event.target.type;
        if (event.target instanceof HTMLInputElement) {
            switch (type) {
                case 'text':
                    typedValue =
                        event.target.value === 'null'
                            ? null
                            : event.target.value;
                    break;
                case 'number':
                    typedValue = parseFloat(event.target.value);
                    break;
                case 'checkbox':
                    typedValue = event.target.checked;
                    break;
                default:
                    typedValue = null;
                    console.warn('unknown type ', type);
            }
        } else {
            typedValue = parseInt(event.target.value, 10);
        }
        obj[fieldNameToChange] = typedValue;
        this._applyChanges(devices);
    };

    private _handleValueNullify = (fieldName: string) => () => {
        const devices = this._getDevicesCopy();
        const { obj, path: fieldNameToChange } = this._getObjectPartByPath(
            devices[this.state.selectedDevice],
            fieldName
        );
        if (!obj) {
            return;
        }
        obj[fieldNameToChange] = null;
        this._applyChanges(devices);
    };

    private _handleValueDelete = (fieldName: string) => () => {
        const devices = this._getDevicesCopy();
        const { obj, path: fieldNameToChange } = this._getObjectPartByPath(
            devices[this.state.selectedDevice],
            fieldName
        );
        if (!obj) {
            return;
        }
        delete obj[fieldNameToChange];
        this._applyChanges(devices);
    };

    private _handleValueCreate = (fieldName: string) => () => {
        const devices = this._getDevicesCopy();
        const schema = this._getSchema();
        if (schema) {
            const { obj, path: fieldNameToChange } = this._getObjectPartByPath(
                devices[this.state.selectedDevice],
                fieldName
            );
            const {
                obj: schemaObj,
                path: fieldNameFromSchema
            } = this._getObjectPartByPath(schema, fieldName);
            if (!obj || !schemaObj || !fieldNameToChange) {
                return;
            }
            const schemaPart = schemaObj[fieldNameFromSchema] as JsonObject | IFullType;
            if (schemaPart.__type) {
                const newValue = this._getDefaultValueByFullType(schemaPart as IFullType);
                if (newValue !== undefined) {
                    obj[fieldNameToChange] = newValue;
                }
            } else {
                obj[fieldNameToChange] = {};
                for (const key in schemaPart) {
                    if (schemaPart.hasOwnProperty(key) && !key.startsWith('__')) {
                        const fullType = schemaPart[key] as string | IFullType;
                        const newValue = this._getDefaultValueByFullType(fullType);
                        if (newValue !== undefined) {
                            (obj[fieldNameToChange] as Record<string, unknown>)[
                                key
                                ] = newValue;
                        }
                    }
                }
            }
            this._applyChanges(devices);
        }
    };

    private _getDefaultValueByFullType(fullType: string | IFullType): Json | undefined {
        let type;
        let defaultValue;
        if (typeof fullType === 'object' && fullType) {
            type = fullType.__type;
            defaultValue = fullType.__defaultValue;
        } else {
            type = fullType;
        }
        let newValue;
        switch (type) {
            case 'string':
                newValue = defaultValue ?? '';
                break;
            case 'number':
                newValue = defaultValue ?? 1;
                break;
            case 'enum':
                newValue = defaultValue ?? 1;
                break;
            case 'boolean':
                newValue = defaultValue ?? false;
                break;
        }
        return newValue;
    }

    private _applyChanges(newDevices: Record<string, JsonObject>): void {
        const newState: Pick<
            IState,
            'devices' | 'hasChanges' | 'originalDevice'
            > = {
            devices: newDevices
        };
        const originalDevice =
            this.state.originalDevice ??
                JSON.stringify(this.state.devices[this.state.selectedDevice]);
        if (!this.state.hasChanges) {
            newState.hasChanges = true;
            newState.originalDevice = originalDevice;
        }
        this.setState(newState);
    }

    private _handleSaveDevice = (): void => {
        chrome.tabs.sendMessage(
            this._tabId,
            {
                action: 'set',
                key: this.state.selectedDevice,
                data: JSON.stringify(
                    this.state.devices[this.state.selectedDevice]
                )
            },
            () => {
                this._getDevices();
            }
        );
    };

    private _handleResetDevice = (): void => {
        if (this.state.originalDevice) {
            const devices = this._getDevicesCopy();
            devices[this.state.selectedDevice] = JSON.parse(
                this.state.originalDevice
            );
            this.setState({
                devices,
                hasChanges: false,
                originalDevice: undefined
            });
        }
    };

    private _handleImportDevice = async () => {
        this._isDeviceImport = true;
        this.fileInput.current?.click();
    };

    private _handleImportSettings = () => {
        this._isDeviceImport = false;
        this.fileInput.current?.click();
    };

    private _handleExportSettings = () => {
        exportJson(this.state.settings, 'settings.json');
    };

    private _handleResetSettings = () => {
        chrome.storage.local.set(
            {
                settings: defaultSettings
            },
            () => {
                this.setState({
                    settings: defaultSettings
                });
            }
        );
    };

    private _handleFileChange = async () => {
        const files = this.fileInput.current?.files;
        let content: typeof defaultSettings | JsonObject;
        if (files) {
            try {
                const text = await files[0].text();
                content = JSON.parse(text);
                if (content) {
                    if (this._isDeviceImport) {
                        const devices = this._getDevicesCopy();
                        devices[this.state.selectedDevice] = content;
                        this.setState({
                            devices
                        });
                    } else {
                        chrome.storage.local.set(
                            {
                                settings: content
                            },
                            () => {
                                this.setState({
                                    settings: content as typeof defaultSettings
                                });
                            }
                        );
                    }
                }
            } catch (e) {
                window.alert(`Ошибка загрузки файла: ${e.message}`);
            }
        }
    };

    private _handleExportDevice = () => {
        exportJson(
            this.state.devices[this.state.selectedDevice],
            `${this._beautifyKey(this.state.selectedDevice)}.json`
        );
    };

    private _handleOpenHelp = () => {
        chrome.tabs.create({ url: this._getSchema()?.__help as string });
    };

    private _getSchema(): JsonObject {
        const selectedDevice = this.state.selectedDevice.toLowerCase();
        const supported = Object.keys(this.state.settings.schemas);
        const schemaNames = supported.find((name) =>
            selectedDevice.includes(name)
        );
        return schemaNames
            ? this.state.settings.schemas[schemaNames]
            : undefined;
    }

    private _getDevicesCopy(): IState['devices'] {
        return JSON.parse(JSON.stringify(this.state.devices));
    }

    private _getRenderByObject(
        obj: { [property: string]: Json },
        path?: string,
        calculatedType?: string | IFullType
    ): JSX.Element {
        const schema = this._getSchema();
        if (!schema) {
            return <div>Нет схемы в settings.json для текущего устройства</div>;
        }
        const items: JSX.Element[] = [];
        for (const key in obj) {
            const current = obj[key];
            const valuePath = path ? `${path}/${key}` : key;
            const {
                obj: schemaObj,
                path: schemaPath
            } = this._getObjectPartByPath(schema, valuePath);
            let fullType = calculatedType
                ? typeof calculatedType === 'string'
                    ? { __type: calculatedType }
                    : calculatedType
                : schemaObj &&
                ((schemaObj[schemaPath] as unknown) as IFullType);
            let help;
            if (fullType && typeof fullType === 'object') {
                help = fullType.__help?.join('\r\n');
            } else if (!fullType) {
                fullType = {
                    __type: typeof current
                };
            } else {
                fullType = {
                    __type: String(fullType)
                };
            }
            const type = fullType.__type;
            const iconDelete = (
                <IconButton
                    className={'leftMargin minFlexShrink'}
                    icon={'x-square'}
                    onClick={this._handleValueDelete(
                        valuePath
                    )}
                />
            );
            if (fullType.__nullable && current === null) {
                items.push(
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                        {key}:{' '}
                        <IconButton
                            className={'leftMargin'}
                            icon={'plus-square'}
                            onClick={this._handleValueCreate(valuePath)}
                        />
                    </div>
                );
            } else if (['number', 'string', 'boolean'].includes(type)) {
                const typeToInput = {
                    number: 'number',
                    string: 'text',
                    boolean: 'checkbox'
                };
                const inputProps: Record<string, unknown> = {};
                if (type === 'boolean') {
                    inputProps.checked = current || current === 'true';
                } else {
                    inputProps.style = { flexGrow: 1 };
                    inputProps.value =
                        current === null ? 'null' : (current as string);
                }
                items.push(
                    <label style={{ whiteSpace: 'pre', display: 'flex' }}>
                        {help && (
                            <IconButton
                                icon={'info'}
                                className={'rightMargin'}
                                title={help}
                            />
                        )}
                        {key}
                        {' : '}
                        <input
                            {...inputProps}
                            type={typeToInput[type]}
                            onChange={this._handleValueChange(valuePath)}
                            disabled={fullType.__readOnly}
                        />
                        {fullType.__deletable && iconDelete}
                    </label>
                );
            } else {
                let selectOptions;
                const possibleKeys: JSX.Element[] = [];
                switch (type) {
                    case 'enum':
                        if (typeof fullType.__name !== 'string') {
                            throw Error('Enums should have a name');
                        }
                        selectOptions = (fullType.__enum || this.state.settings.enums[
                            fullType.__name
                            ]).map((item: IEnumElement) => {
                            return (
                                <option key={item.key} value={item.key}>
                                    {`${item.title} [${item.key}]`}
                                </option>
                            );
                        });
                        items.push(
                            <label
                                style={{
                                    whiteSpace: 'pre',
                                    display: 'flex',
                                    maxWidth: '400px'
                                }}>
                                {key} :{' '}
                                <select
                                    style={{ flexGrow: 1, flexShrink: 1, minWidth: '1px' }}
                                    value={current as string}
                                    onChange={this._handleValueChange(
                                        valuePath
                                    )}>
                                    {selectOptions}
                                </select>
                                {fullType.__deletable && iconDelete}
                            </label>
                        );
                        break;
                    case 'generic':
                        fullType.__possibleValues?.forEach((possibleKey) => {
                            if (
                                !(current as JsonObject).hasOwnProperty(
                                    possibleKey
                                )
                            ) {
                                possibleKeys.push(
                                    <div
                                        key={possibleKey}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                        {possibleKey}:{' '}
                                        <IconButton
                                            className={'leftMargin'}
                                            icon={'plus-square'}
                                            onClick={this._handleValueCreate(
                                                `${valuePath}/${possibleKey}`
                                            )}
                                        />
                                    </div>
                                );
                            }
                        });
                        items.push(
                            <fieldset>
                                <legend>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                        {key}
                                        {fullType.__nullable && (
                                            <IconButton
                                                className={'leftMargin'}
                                                icon={'x-square'}
                                                onClick={this._handleValueDelete(
                                                    valuePath
                                                )}
                                            />
                                        )}
                                    </div>
                                </legend>
                                {this._getRenderByObject(
                                    current as JsonObject,
                                    valuePath
                                )}
                                {possibleKeys}
                            </fieldset>
                        );
                        break;
                    default:
                        items.push(
                            <fieldset>
                                <legend>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                        {key}
                                        {fullType.__nullable && (
                                            <IconButton
                                                className={'leftMargin'}
                                                icon={'x-square'}
                                                onClick={this._handleValueNullify(
                                                    valuePath
                                                )}
                                            />
                                        )}
                                        {fullType.__deletable && iconDelete}
                                    </div>
                                </legend>
                                {this._getRenderByObject(
                                    current as JsonObject,
                                    valuePath
                                )}
                            </fieldset>
                        );
                }
            }
        }
        return (
            <div>
                {items.map((item, idx) => (
                    <div className={'paddedBlock'} key={idx}>
                        {item}
                    </div>
                ))}
            </div>
        );
    }

    private _getStaticButtons(): JSX.Element {
        return (
            <div className={'deviceStaticButtons'}>
                <hr className={'separator'} />
                {this._getSchema()?.__help && (
                    <IconButton
                        className={'leftMargin'}
                        icon={'help-circle'}
                        title={'API'}
                        onClick={this._handleOpenHelp}
                    />
                )}
                <IconButton
                    className={'leftMargin'}
                    icon={'upload'}
                    title={'Import'}
                    onClick={this._handleImportDevice}
                />
                <IconButton
                    className={'leftMargin'}
                    icon={'download'}
                    title={'Export'}
                    onClick={this._handleExportDevice}
                />
            </div>
        );
    }

    render() {
        const selectOptions = Object.keys(this.state.devices).map((key) => {
            return (
                <option key={key} value={key}>
                    {this._beautifyKey(key)}
                </option>
            );
        });
        let body;
        if (this.state.selectedDevice) {
            body = this._getSchema()
                ? this._getRenderByObject(
                    this.state.devices[this.state.selectedDevice]
                )
                : 'Device not supported';
        }
        const hasDevices = !!Object.keys(this.state.devices).length;
        return (
            <HotKeys
                keyMap={this._keyMap}
                handlers={this._keyHandlers}
                className={'hotkeysContainer'}>
                <div className='popup-padded'>
                    <input
                        type='file'
                        accept='.json'
                        value={''}
                        ref={this.fileInput}
                        onChange={this._handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <div className='header'>
                        <MainHeader
                            onExportSettings={this._handleExportSettings}
                            onImportSettings={this._handleImportSettings}
                            onResetSettings={this._handleResetSettings}
                        />
                        <hr />
                        <div>
                            {!hasDevices ? (
                                <div>Устройств не найдено</div>
                            ) : (
                                <div className={'rowWithIcons'}>
                                    <select
                                        onChange={
                                            this._handleSelectedDeviceChange
                                        }
                                        name=''
                                        id='device'
                                        disabled={this.state.hasChanges}
                                        value={this.state.selectedDevice}>
                                        {selectOptions}
                                    </select>
                                    <IconButton
                                        className={'leftMargin'}
                                        icon={'trash-2'}
                                        title={'Remove'}
                                        onClick={this._handleRemoveDevice}
                                    />
                                    {this.state.hasChanges && (
                                        <div className={'deviceDynamicButtons'}>
                                            <hr className={'separator'} />
                                            <IconButton
                                                className={'leftMargin'}
                                                icon={'save'}
                                                type={'green'}
                                                title={'Ctrl+S'}
                                                onClick={this._handleSaveDevice}
                                            />
                                            <IconButton
                                                className={'leftMargin'}
                                                icon={'x-circle'}
                                                type={'red'}
                                                title={'Ctrl+Z'}
                                                onClick={
                                                    this._handleResetDevice
                                                }
                                            />
                                        </div>
                                    )}
                                    {this._getStaticButtons()}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        {hasDevices
                            ? body
                            : 'Если устройств не нашлось, попробуйте обновить страницу или добавить новое.'}
                    </div>
                </div>
            </HotKeys>
        );
    }

    componentDidMount() {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab && tab.id) {
                this._tabId = tab.id;
                this._getDevices().then(() => {
                    chrome.storage.local.get(
                        'selectedDevice',
                        ({ selectedDevice }) => {
                            this.setState({
                                selectedDevice: this.state.devices.hasOwnProperty(
                                    selectedDevice
                                )
                                    ? selectedDevice
                                    : this.state.selectedDevice
                            });
                        }
                    );
                });
            }
        });
    }

    private _handleRemoveDevice = () => {
        chrome.tabs.sendMessage(
            this._tabId,
            { action: 'remove', key: this.state.selectedDevice },
            () => {
                this.setState({
                    selectedDevice: 'None'
                });
                this._getDevices();
            }
        );
    };

    private _getDevices(): Promise<void> {
        if (!this._tabId) {
            throw Error('Нет подключенной вкладки');
        }
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(
                this._tabId,
                { action: 'get', prefix: this.state.settings.prefix },
                (response) => {
                    if (response) {
                        const devices: Record<string, JsonObject> = {};
                        Object.keys(response).forEach((key) => {
                            devices[key] = JSON.parse(response[key]);
                        });
                        const keys = Object.keys(response);
                        const defaultKey = keys[0] || this.state.selectedDevice;
                        this.setState(
                            {
                                devices,
                                selectedDevice:
                                    this.state.selectedDevice == 'None'
                                        ? defaultKey
                                        : this.state.selectedDevice,
                                hasChanges: false,
                                originalDevice: undefined
                            },
                            resolve as () => void
                        );
                    } else {
                        resolve();
                    }
                }
            );
        });
    }
}

ReactDOM.render(
    <ErrorBoundary>
        <Main />
    </ErrorBoundary>,
    document.getElementById('root')
);
