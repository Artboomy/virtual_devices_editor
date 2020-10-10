chrome.runtime.sendMessage({}, () => {
    const checkReady = setInterval(() => {
        if (document.readyState === 'complete') {
            console.debug('VirtualDevicesEditor content script injected');
            clearInterval(checkReady);
            chrome.runtime.onConnect.addListener((port) => {
                console.info(port);
            });
            // const port = chrome.runtime.connect({name: 'content'});
            chrome.runtime.onMessage.addListener(
                (msg, _sender, sendResponse) => {
                    console.debug('VirtualDevicesEditor msg received: ', msg);
                    switch (msg.action) {
                        case 'get':
                            sendResponse(getDevices(msg.prefix));
                            break;
                        case 'set':
                            setDevice(msg.key, msg.data);
                            break;
                        case 'remove':
                            removeDevice(msg.key);
                            break;
                        default:
                            console.warn('Unrecognized message: ', msg);
                    }
                }
            );
        }
    });
});

function getDevices(prefix: string) {
    const devices: Record<string, string> = {};
    Object.keys(localStorage).forEach((key) => {
        if (key.includes(prefix)) {
            devices[key] = localStorage.getItem(key) || '';
        }
    });
    return devices;
}

function setDevice(key: string, data: string) {
    localStorage.setItem(key, data);
}

function removeDevice(key: string) {
    localStorage.removeItem(key);
}
