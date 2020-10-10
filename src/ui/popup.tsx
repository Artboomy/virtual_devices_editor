import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../styles/popup.css';
import { ChangeEvent, RefObject } from 'react';
import ErrorBoundary from './errorBoundary';

import * as defaultSettings from './settings.json';
import IconButton from './iconButton';

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

class Main extends React.Component<Record<string, unknown>, IState> {
    _tabId: number;
    fileInput: RefObject<HTMLInputElement>;
    private _isDeviceImport = false;

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
                        if (newObj[part] === undefined) {
                            console.info(
                                `${part} is undefined for object`,
                                newObj
                            );
                        } else {
                            newObj = newObj[part] as JsonObject;
                        }
                    }
                } else {
                    newPath = part;
                    if (newObj && newObj[newPath] === undefined) {
                        if (newObj.__type === 'generic') {
                            newObj[newPath] = this.state.settings.generics[
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
                    typedValue = event.target.value;
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
            obj[fieldNameToChange] = {};
            const schemaPart = schemaObj[fieldNameFromSchema] as JsonObject;
            for (const key in schemaPart) {
                if (schemaPart.hasOwnProperty(key) && !key.startsWith('__')) {
                    let type = schemaPart[key];
                    if (typeof type === 'object' && type) {
                        type = (type as JsonObject).__type;
                    }
                    let newValue;
                    switch (type) {
                        case 'string':
                            newValue = '';
                            break;
                        case 'number':
                            newValue = 1;
                            break;
                        case 'enum':
                            newValue = 1;
                            break;
                        case 'boolean':
                            newValue = false;
                            break;
                    }
                    if (newValue !== undefined) {
                        (obj[fieldNameToChange] as Record<string, unknown>)[
                            key
                        ] = newValue;
                    }
                }
            }
            this._applyChanges(devices);
        }
    };

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

    private _handleOpenGithub = () => {
        chrome.tabs.create({
            url: 'https://github.com/Artboomy/virtual_devices_editor'
        });
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
        let schemaKey;
        const selectedDevice = this.state.selectedDevice.toLowerCase();
        if (selectedDevice.includes('kkm')) {
            schemaKey = 'kkm';
        } else if (selectedDevice.includes('posscanner')) {
            schemaKey = 'posscanner';
        }
        return schemaKey ? this.state.settings.schemas[schemaKey] : undefined;
    }

    private _getDevicesCopy(): IState['devices'] {
        return JSON.parse(JSON.stringify(this.state.devices));
    }

    private _getRenderByObject(
        obj: { [property: string]: Json },
        path?: string,
        calculatedType?: string | JsonObject
    ): JSX.Element {
        const items: JSX.Element[] = [];
        const schema = this._getSchema();
        for (const key in obj) {
            const current = obj[key];
            const valuePath = path ? `${path}/${key}` : key;
            if (schema) {
                const { obj, path } = this._getObjectPartByPath(
                    schema,
                    valuePath
                );
                let type = calculatedType ? calculatedType : obj && obj[path];
                if (type === undefined) {
                    type = typeof current;
                }
                if (type === 'number') {
                    items.push(
                        <label style={{ whiteSpace: 'pre', display: 'flex' }}>
                            {key} :{' '}
                            <input
                                style={{ flexGrow: 1 }}
                                type='number'
                                onChange={this._handleValueChange(valuePath)}
                                value={current as number}
                                disabled={key === 'version'}
                            />
                        </label>
                    );
                } else if (type === 'string') {
                    items.push(
                        <label style={{ whiteSpace: 'pre', display: 'flex' }}>
                            {key} :{' '}
                            <input
                                style={{ flexGrow: 1 }}
                                onChange={this._handleValueChange(valuePath)}
                                value={current as string}
                            />
                        </label>
                    );
                } else if (type === 'boolean') {
                    items.push(
                        <label style={{ whiteSpace: 'pre', display: 'flex' }}>
                            {key} :{' '}
                            <input
                                type='checkbox'
                                onChange={this._handleValueChange(valuePath)}
                                checked={current as boolean}
                            />
                        </label>
                    );
                } else if (Array.isArray(type)) {
                    items.push(<div>::Array placeholder::</div>);
                } else if (type && typeof type === 'object') {
                    let selectOptions;
                    const possibleKeys: JSX.Element[] = [];
                    switch (type.__type) {
                        case 'number':
                            items.push(
                                <label
                                    style={{
                                        whiteSpace: 'pre',
                                        display: 'flex'
                                    }}>
                                    {type.__help && (
                                        <IconButton
                                            icon={'info'}
                                            className={'rightMargin'}
                                            title={(type.__help as string[]).join(
                                                '\r\n'
                                            )}
                                        />
                                    )}
                                    {key} :{' '}
                                    <input
                                        style={{ flexGrow: 1 }}
                                        type='number'
                                        onChange={this._handleValueChange(
                                            valuePath
                                        )}
                                        value={current as number}
                                        disabled={key === 'version'}
                                    />
                                </label>
                            );
                            break;
                        case 'enum':
                            if (typeof type.__name !== 'string') {
                                throw Error('Enums should have a name');
                            }
                            selectOptions = this.state.settings.enums[
                                type.__name as string
                            ].map((item: IEnumElement) => {
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
                                        display: 'flex'
                                    }}>
                                    {key} :{' '}
                                    <select
                                        className={
                                            type.__name
                                                .toLowerCase()
                                                .includes('error')
                                                ? 'errorTypeSelect'
                                                : ''
                                        }
                                        style={{ flexGrow: 1 }}
                                        value={current as string}
                                        onChange={this._handleValueChange(
                                            valuePath
                                        )}>
                                        {selectOptions}
                                    </select>
                                </label>
                            );
                            break;
                        case 'generic':
                            (type.__possibleValues as string[]).forEach(
                                (possibleKey) => {
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
                                }
                            );
                            items.push(
                                <fieldset>
                                    <legend>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>
                                            {key}
                                            {type.__nullable && (
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
                            if (type.__nullable && current === null) {
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
                                            onClick={this._handleValueCreate(
                                                valuePath
                                            )}
                                        />
                                    </div>
                                );
                            } else {
                                items.push(
                                    <fieldset>
                                        <legend>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                {key}
                                                {type.__nullable && (
                                                    <IconButton
                                                        className={'leftMargin'}
                                                        icon={'x-square'}
                                                        onClick={this._handleValueNullify(
                                                            valuePath
                                                        )}
                                                    />
                                                )}
                                                {type.__deletable && (
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
                                    </fieldset>
                                );
                            }
                    }
                } else {
                    items.push(
                        <label style={{ whiteSpace: 'pre', display: 'flex' }}>
                            {key} :{' '}
                            <input
                                style={{ flexGrow: 1 }}
                                onChange={this._handleValueChange(valuePath)}
                                value={current as string}
                            />
                        </label>
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
                    <div className={'topRow'}>
                        <div className={'title'}>
                            VirtualDevices-
                            {chrome.runtime.getManifest().version}
                            <IconButton
                                className={'leftMargin'}
                                icon={'github'}
                                title={'Github'}
                                onClick={this._handleOpenGithub}
                            />
                        </div>
                        <div className={'rowWithIcons'}>
                            <span>Settings: </span>
                            <IconButton
                                className={'leftMargin'}
                                icon={'x-circle'}
                                title={'Reset settings'}
                                onClick={this._handleResetSettings}
                            />
                            <IconButton
                                className={'leftMargin'}
                                icon={'upload'}
                                title={'Import settings'}
                                onClick={this._handleImportSettings}
                            />
                            <IconButton
                                className={'leftMargin'}
                                icon={'download'}
                                title={'Export settings'}
                                onClick={this._handleExportSettings}
                            />
                        </div>
                    </div>
                    <hr />
                    <div>
                        {!hasDevices ? (
                            <div>No devices present</div>
                        ) : (
                            <div className={'rowWithIcons'}>
                                <select
                                    onChange={this._handleSelectedDeviceChange}
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
                                            title={'Save changes'}
                                            onClick={this._handleSaveDevice}
                                        />
                                        <IconButton
                                            className={'leftMargin'}
                                            icon={'x-circle'}
                                            title={'Reset changes'}
                                            onClick={this._handleResetDevice}
                                        />
                                    </div>
                                )}
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
                            </div>
                        )}
                    </div>
                </div>
                <div>{body}</div>
            </div>
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

    private _getDevices() {
        return new Promise((resolve) => {
            if (this._tabId) {
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
                            const defaultKey =
                                keys[0] || this.state.selectedDevice;
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
                                resolve
                            );
                        } else {
                            resolve();
                        }
                    }
                );
            } else {
                resolve();
            }
        });
    }
}

ReactDOM.render(
    <ErrorBoundary>
        <Main />
    </ErrorBoundary>,
    document.getElementById('root')
);
