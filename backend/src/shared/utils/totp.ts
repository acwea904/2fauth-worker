import { sanitizeInput } from '@/shared/utils/common';

export function validateBase32Secret(secret: any): boolean {
    if (!secret || typeof secret !== 'string') return false;
    const cleaned = secret.replace(/\s/g, '').toUpperCase();
    return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.length >= 16;
}

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(encoded: string): Uint8Array {
    const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    const buffer = new Uint8Array(Math.floor(cleanInput.length * 5 / 8));
    let bits = 0, value = 0, index = 0;

    for (let i = 0; i < cleanInput.length; i++) {
        const charValue = BASE32_CHARS.indexOf(cleanInput[i]);
        if (charValue === -1) continue;
        value = (value << 5) | charValue;
        bits += 5;
        if (bits >= 8) {
            buffer[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return buffer;
}

export async function hmacSHA1(key: Uint8Array | string, data: number): Promise<Uint8Array> {
    const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const dataBuffer = new ArrayBuffer(8);
    new DataView(dataBuffer).setBigUint64(0, BigInt(data), false);

    const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer as any, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    // @ts-ignore Cloudflare WebCrypto types mismatch with standard BufferSource
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer as any as ArrayBuffer);
    return new Uint8Array(signature);
}

export async function generateTOTP(secret: string | Uint8Array, timeStep = 30, digits = 6): Promise<string> {
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const secretBytes = typeof secret === 'string' ? base32Decode(secret) : secret;

    const hmac = await hmacSHA1(secretBytes, time);
    const offset = hmac[hmac.length - 1] & 0xf;

    const code = (((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)) % Math.pow(10, digits);

    return code.toString().padStart(digits, '0');
}

export function parseOTPAuthURI(uri: string) {
    try {
        if (!uri || typeof uri !== 'string' || uri.length > 1000) return null;
        const url = new URL(uri);
        if (url.protocol !== 'otpauth:') return null;

        const type = url.hostname;
        if (type !== 'totp' && type !== 'hotp') return null;

        const label = decodeURIComponent(url.pathname.substring(1));
        const params = new URLSearchParams(url.search);

        const secret = params.get('secret');
        if (!validateBase32Secret(secret)) return null;

        const [issuer, account] = label.includes(':') ? label.split(':', 2) : ['', label];
        const digits = parseInt(params.get('digits') || '6');
        const period = parseInt(params.get('period') || '30');

        if (digits < 6 || digits > 8 || period < 15 || period > 300) return null;

        return {
            type,
            label: sanitizeInput(label, 100),
            issuer: sanitizeInput(params.get('issuer') || issuer, 50),
            account: sanitizeInput(account || label, 100),
            secret: secret!,
            algorithm: (params.get('algorithm') || 'SHA1').toUpperCase(),
            digits,
            period
        };
    } catch {
        return null;
    }
}
