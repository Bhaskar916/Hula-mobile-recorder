import { exec } from 'child_process';
import { promisify } from 'util';
import { xml2js } from 'xml-js';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface Point {
    x: number;
    y: number;
}

interface ElementData {
    bounds: string;
    [key: string]: any;
}

// A simple recursive search to find the smallest element containing the point
function findElement(node: any, point: Point): ElementData | null {
    if (!node.attributes) {
        return null;
    }

    const boundsStr = node.attributes.bounds;
    if (!boundsStr) {
        let foundChild: ElementData | null = null;
        if (node.elements) {
            for (const child of node.elements) {
                const found = findElement(child, point);
                if (found) {
                    foundChild = found;
                }
            }
        }
        return foundChild;
    }

    const bounds = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!bounds) {
        return null;
    }

    const [x1, y1, x2, y2] = bounds.slice(1).map(Number);

    if (point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2) {
        let bestFit: ElementData | null = node.attributes;
        if (node.elements) {
            for (const child of node.elements) {
                const found = findElement(child, point);
                if (found) {
                    bestFit = found; // Deeper child is a better fit
                }
            }
        }
        return bestFit;
    }

    return null;
}

function generateXPath(node: any): string {
    if (!node || !node.attributes) {
        return '';
    }
    const { class: className, 'content-desc': contentDesc, 'resource-id': resourceId, text, index } = node.attributes;

    let path = `//${className || '*'}`;
    const predicates = [];
    if (resourceId) {
        predicates.push(`@resource-id='${resourceId}'`);
    }
    if (contentDesc) {
        predicates.push(`@content-desc='${contentDesc}'`);
    }
    if (text) {
        predicates.push(`@text='${text}'`);
    }
    if (index) {
        predicates.push(`@index='${index}'`);
    }

    if (predicates.length > 0) {
        path += `[${predicates.join(' and ')}]`;
    }
    return path;
}

export async function getElementDataFromCoordinates(udid: string, point: Point): Promise<any | null> {
    const tempFile = path.join(__dirname, `ui_dump_${udid}.xml`);
    try {
        await execAsync(`adb -s ${udid} shell uiautomator dump /sdcard/ui_dump.xml`);
        await execAsync(`adb -s ${udid} pull /sdcard/ui_dump.xml "${tempFile}"`);
        const xmlContent = fs.readFileSync(tempFile, 'utf-8');
        const jsObject: any = xml2js(xmlContent, { compact: false });
        const root = jsObject.elements.find((e: any) => e.name === 'hierarchy');
        const element = findElement(root, point);
        if (element) {
            const xpath = generateXPath({ attributes: element });
            return { ...element, xpath };
        }
        return null;
    } catch (error) {
        console.error('Error getting element data:', error);
        return null;
    } finally {
        await execAsync(`adb -s ${udid} shell rm /sdcard/ui_dump.xml`).catch(() => {});
        fs.unlink(tempFile, () => {});
    }
}
