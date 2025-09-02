import { Mw, RequestParameters } from '../../mw/Mw';
import { AdbUtils } from '../AdbUtils';
import { ACTION } from '../../../common/Action';
import WebSocket, { MessageEvent } from 'ws';
import { getElementDataFromCoordinates } from '../../appium-helper';

export class WebsocketProxyOverAdb extends Mw {
    private static readonly TAG = 'WebsocketProxyOverAdb';
    private adbConnection?: WebSocket;

    public static processRequest(ws: WebSocket, params: RequestParameters): WebsocketProxyOverAdb | undefined {
        const { action, url } = params;
        let udid: string | null = '';
        let remote: string | null = '';
        let path: string | null = '';
        let isSuitable = false;
        if (action === ACTION.PROXY_ADB) {
            isSuitable = true;
            remote = url.searchParams.get('remote') as string;
            udid = url.searchParams.get('udid') as string;
            path = url.searchParams.get('path');
        }
        if (url && url.pathname) {
            const temp = url.pathname.split('/');
            // Shortcut for action=proxy, without query string
            if (temp.length >= 4 && temp[0] === '' && temp[1] === ACTION.PROXY_ADB) {
                isSuitable = true;
                temp.splice(0, 2);
                udid = decodeURIComponent(temp.shift() || '') as string;
                remote = decodeURIComponent(temp.shift() || '') as string;
                path = temp.join('/') || '/';
            }
        }
        if (!isSuitable) {
            return;
        }
        if (typeof remote !== 'string' || !remote) {
            ws.close(4003, `[${this.TAG}] Invalid value for "remote" parameter: "${remote}"`);
            return;
        }
        if (typeof udid !== 'string' || !udid) {
            ws.close(4003, `[${this.TAG}] Invalid value for "udid" parameter: "${udid}"`);
            return;
        }
        if (path && typeof path !== 'string') {
            ws.close(4003, `[${this.TAG}] Invalid value for "path" parameter: "${path}"`);
            return;
        }
        return new WebsocketProxyOverAdb(ws, udid, remote, path);
    }

    constructor(ws: WebSocket, udid: string, remote: string, path?: string | null) {
        super(ws);
        AdbUtils.forward(udid, remote)
            .then((port) => {
                const url = `ws://127.0.0.1:${port}${path ? path : ''}`;
                const adbConnection = new WebSocket(url);
                this.adbConnection = adbConnection;
                adbConnection.onopen = () => {
                    // Connection to device is open, we can now handle messages from the client
                };
                adbConnection.onmessage = (event) => {
                    // Message from device -> send to client
                    this.ws.send(event.data as any);
                };
                adbConnection.onclose = (e) => {
                    // Use a default code if the event code is not a valid WebSocket code
                    this.ws.close(e.code < 1000 || e.code > 4999 ? 1011 : e.code, e.reason);
                };
                adbConnection.onerror = (e) => this.ws.close(1011, e.message);
            })
            .catch((e) => {
                const msg = `[${WebsocketProxyOverAdb.TAG}] Failed to start service: ${e.message}`;
                console.error(msg);
                ws.close(4005, msg);
            });
    }

    public async onSocketMessage(event: MessageEvent): Promise<void> {
        const message = event.data;

        // We only care about string messages for our custom 'getXPath' command.
        if (typeof message === 'string') {
            try {
                const msg = JSON.parse(message);
                if (msg.type === 'getElementData' && msg.data) {
                    const { udid, point, screenSize } = msg.data;
                    const elementData = await getElementDataFromCoordinates(udid, point);
                    const response = {
                        type: 'elementDataResult',
                        data: { elementData, originalPoint: point, originalScreenSize: screenSize }
                    };
                    this.ws.send(JSON.stringify(response));
                    // Message handled, do not forward to the device.
                    return;
                }
            } catch (e: any) {
                // Not a JSON message or is malformed, fall through to forward it.
            }
        }

        // Forward all other messages (binary controls, and unhandled strings) to the device.
        if (this.adbConnection && this.adbConnection.readyState === WebSocket.OPEN) {
            this.adbConnection.send(message);
        }
    }
}
