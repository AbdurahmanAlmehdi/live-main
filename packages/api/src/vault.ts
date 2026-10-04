import type { KeyVault } from './ports.js';

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * AES-256-GCM with a 32-byte master key (base64), via WebCrypto so it runs in Node and in
 * Workers. Sealed form: base64(iv) + "." + base64(ciphertext+tag).
 */
export function webCryptoVault(masterKeyBase64: string): KeyVault {
  const raw = unb64(masterKeyBase64);
  if (raw.length !== 32) throw new Error('master key must be 32 bytes (base64)');
  const key = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return {
    async seal(plaintext) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key, new TextEncoder().encode(plaintext)));
      return `${b64(iv)}.${b64(ct)}`;
    },
    async open(sealed) {
      const [iv, ct] = sealed.split('.');
      if (!iv || !ct) throw new Error('malformed sealed value');
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key, unb64(ct));
      return new TextDecoder().decode(pt);
    },
  };
}

/** A fresh random master key (base64), for first-run setup. */
export function newMasterKey(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32)));
}
