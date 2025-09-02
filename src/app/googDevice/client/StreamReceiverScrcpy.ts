import { StreamReceiver } from '../../client/StreamReceiver';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import { ACTION } from '../../../common/Action';
import Util from '../../Util';

export class StreamReceiverScrcpy extends StreamReceiver<ParamsStreamScrcpy> {
    public static parseParameters(params: URLSearchParams): ParamsStreamScrcpy {
        const typedParams = super.parseParameters(params);
        const { action } = typedParams;
        if (action !== ACTION.STREAM_SCRCPY) {
            throw Error('Incorrect action');
        }
        return {
            ...typedParams,
            action,
            udid: Util.parseString(params, 'udid', true),
            ws: Util.parseString(params, 'ws', true),
            player: Util.parseString(params, 'player', true),
        };
    }

    protected buildDirectWebSocketUrl(): URL {
        return new URL((this.params as ParamsStreamScrcpy).ws);
    }

    protected onSocketMessage(e: MessageEvent): void {
        if (typeof e.data === 'string') {
            try {
                const message = JSON.parse(e.data);
                if (message.type === 'elementDataResult') {
                    this.emit(message.type as any, message.data);
                    return;
                }
            } catch (error) {
                // fall through
            }
        }
        super.onSocketMessage(e);
    }

    public send(data: string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }
}
