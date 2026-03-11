import argon2 from 'argon2-browser/dist/argon2-bundled.min.js';
import { parseOtpUri } from '@/shared/utils/totp';

export default {
    name: 'Proton Pass (.json)',
    fileType: 'application/json, text/plain',

    async parse(fileContent, password) {
        let jsonPayload;
        try {
            jsonPayload = JSON.parse(fileContent);
        } catch (e) {
            throw new Error('INVALID_FORMAT_OR_PASSWORD');
        }

        if (jsonPayload.version !== 1 || !jsonPayload.salt || !jsonPayload.content) {
            throw new Error('INVALID_FORMAT_OR_PASSWORD');
        }

        if (!password) {
            throw new Error('PASSWORD_REQUIRED');
        }

        try {
            // Decode base64 in browser
            const saltStr = atob(jsonPayload.salt);
            const salt = new Uint8Array(saltStr.length);
            for (let i = 0; i < saltStr.length; i++) {
                salt[i] = saltStr.charCodeAt(i);
            }

            const contentStr = atob(jsonPayload.content);
            const content = new Uint8Array(contentStr.length);
            for (let i = 0; i < contentStr.length; i++) {
                content[i] = contentStr.charCodeAt(i);
            }

            // Extract AES-GCM components
            const iv = content.slice(0, 12);
            // WebCrypto decrypter expects ciphertext followed by auth tag in one buffer
            const cipherAndTag = content.slice(12);

            // 1. Derive key via Argon2id
            const argon2Result = await argon2.hash({
                pass: password,
                salt: salt,
                time: 2,
                mem: 19 * 1024,
                hashLen: 32,
                parallelism: 1,
                type: argon2.ArgonType.Argon2id,
                distPath: '/'
            });

            // 2. Decrypt via Web Crypto API
            // argon2-browser returns Uint8Array in argon2Result.hash
            const keyMaterial = argon2Result.hash;

            const cryptoKey = await window.crypto.subtle.importKey(
                'raw',
                keyMaterial,
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            // AAD defined in Rust
            const aad = new TextEncoder().encode('proton.authenticator.export.v1');

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    additionalData: aad,
                    tagLength: 128
                },
                cryptoKey,
                cipherAndTag
            );

            const decryptedString = new TextDecoder().decode(decryptedBuffer);
            const decryptedJson = JSON.parse(decryptedString);

            // 3. Parse items
            const entries = decryptedJson.entries || [];
            const results = [];

            for (const entry of entries) {
                if (entry.content && entry.content.uri) {
                    const parsed = parseOtpUri(entry.content.uri);
                    if (parsed) {
                        results.push(parsed);
                    }
                }
            }

            return results;

        } catch (err) {
            console.error('Proton decryption failed:', err);
            // Must throw this precise message so UI prompts for password again if wrong
            throw new Error('INVALID_FORMAT_OR_PASSWORD');
        }
    }
};
