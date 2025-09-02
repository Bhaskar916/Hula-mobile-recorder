export interface ControlMessageInterface {
    type: number;
}

export class ControlMessage {
    public static TYPE_KEYCODE = 0;
    public static TYPE_TEXT = 1;
    public static TYPE_TOUCH = 2;
    public static TYPE_SCROLL = 3;
    public static TYPE_BACK_OR_SCREEN_ON = 4;
    public static TYPE_EXPAND_NOTIFICATION_PANEL = 5;
    public static TYPE_EXPAND_SETTINGS_PANEL = 6;
    public static TYPE_COLLAPSE_PANELS = 7;
    public static TYPE_GET_CLIPBOARD = 8;
    public static TYPE_SET_CLIPBOARD = 9;
    public static TYPE_SET_SCREEN_POWER_MODE = 10;
    public static TYPE_ROTATE_DEVICE = 11;
    public static TYPE_CHANGE_STREAM_PARAMETERS = 101;
    public static TYPE_PUSH_FILE = 102;

    // Add these properties for touch
    public action?: number;
    public pointerId?: number;
    public position?: any;
    public pressure?: number;
    public buttons?: number;
    public elementData?: any;

    constructor(readonly type: number) {}

    public static fromJSON(json: any): ControlMessage {
        switch (json.type) {
            case ControlMessage.TYPE_TOUCH:
                const msg = new ControlMessage(json.type);
                msg.action = json.action;
                msg.pointerId = json.pointerId;
                msg.position = json.position;
                msg.pressure = json.pressure;
                msg.buttons = json.buttons;
                msg.elementData = json.elementData;
                return msg;
            default:
                return new ControlMessage(json.type);
        }
    }

    public toJSON(): any {
        const json: any = { type: this.type };
        if (this.action !== undefined) json.action = this.action;
        if (this.pointerId !== undefined) json.pointerId = this.pointerId;
        if (this.position !== undefined) json.position = this.position;
        if (this.pressure !== undefined) json.pressure = this.pressure;
        if (this.buttons !== undefined) json.buttons = this.buttons;
        if (this.elementData !== undefined) json.elementData = this.elementData;
        return json;
    }

    public toBuffer(): ArrayBuffer {
        if (this.type === ControlMessage.TYPE_TOUCH) {
            // scrcpy expects: [type (1 byte), action (1 byte), pointerId (8 bytes), x (4 bytes), y (4 bytes), screenWidth (2 bytes), screenHeight (2 bytes), pressure (2 bytes), buttons (4 bytes)]
            const buffer = new ArrayBuffer(1 + 1 + 8 + 4 + 4 + 2 + 2 + 2 + 4);
            const view = new DataView(buffer);
            let offset = 0;
            view.setUint8(offset, this.type); offset += 1;
            view.setUint8(offset, this.action ?? 0); offset += 1;
            view.setBigUint64(offset, BigInt(this.pointerId ?? 0)); offset += 8;
            view.setInt32(offset, this.position?.point?.x ?? 0); offset += 4;
            view.setInt32(offset, this.position?.point?.y ?? 0); offset += 4;
            view.setUint16(offset, this.position?.screenSize?.width ?? 0); offset += 2;
            view.setUint16(offset, this.position?.screenSize?.height ?? 0); offset += 2;
            view.setUint16(offset, Math.floor((this.pressure ?? 1) * 65535)); offset += 2;
            view.setUint32(offset, this.buttons ?? 0); offset += 4;
            return buffer;
        }
        // Add serialization for other types as needed

        // Fallback for unknown types
        return new Uint8Array([this.type]).buffer;
    }

    public toString(): string {
        return 'ControlMessage';
    }

    public scaleTouchPosition(currentWidth: number, currentHeight: number): void {
        if (this.type === ControlMessage.TYPE_TOUCH && this.position) {
            // Example scaling logic
            const recordedWidth = this.position.screenSize?.width ?? 1;
            const recordedHeight = this.position.screenSize?.height ?? 1;

            this.position.point.x = Math.round(this.position.point.x * currentWidth / recordedWidth);
            this.position.point.y = Math.round(this.position.point.y * currentHeight / recordedHeight);
            this.position.screenSize.width = currentWidth;
            this.position.screenSize.height = currentHeight;
        }
    }
}
