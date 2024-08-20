export function base64ToUint8Array(base64String: string) {
    const binaryString = atob(base64String);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export async function blobToFullHash(blob: Blob): Promise<string> {
    const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
            } else {
                reject(new Error("Read result is not an ArrayBuffer"));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });

    const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashBase64: string = bufferToBase64(hashBuffer);

    const urlSafeHash = hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return urlSafeHash;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
    const byteArray = new Uint8Array(buffer);
    const binaryString = Array.from(byteArray, byte => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
}

// type guard function that checks if a value is not undefined, tells TypeScript that after filtering, the value is indeed of type T 
export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}