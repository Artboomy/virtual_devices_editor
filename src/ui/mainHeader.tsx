import * as React from 'react';
import IconButton from './iconButton';

function handleOpenGithub() {
    chrome.tabs.create({
        url: 'https://github.com/Artboomy/virtual_devices_editor'
    });
}

interface IProps {
    onResetSettings: () => void;
    onImportSettings: () => void;
    onExportSettings: () => void;
}

export default function MainHeader(props: IProps): React.ReactElement {
    return (
        <div className={'topRow'}>
            <div className={'title'}>
                VirtualDevices-
                {chrome.runtime.getManifest().version}
                <IconButton
                    className={'leftMargin'}
                    icon={'github'}
                    title={'Github'}
                    onClick={handleOpenGithub}
                />
            </div>
            <div className={'rowWithIcons'}>
                <span>Settings: </span>
                <IconButton
                    className={'leftMargin'}
                    icon={'x-circle'}
                    title={'Reset settings'}
                    onClick={props.onResetSettings}
                />
                <IconButton
                    className={'leftMargin'}
                    icon={'upload'}
                    title={'Import settings'}
                    onClick={props.onImportSettings}
                />
                <IconButton
                    className={'leftMargin'}
                    icon={'download'}
                    title={'Export settings'}
                    onClick={props.onExportSettings}
                />
            </div>
        </div>
    );
}
