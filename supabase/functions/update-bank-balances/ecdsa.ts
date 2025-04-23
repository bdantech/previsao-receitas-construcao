// Polyfill Buffer for Deno
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
globalThis.Buffer = Buffer;
import { Ecdsa, PrivateKey } from 'https://esm.sh/starkbank-ecdsa@1.1.5';
export async function sign(message, rawKeyFromDb) {
  try {
    console.log('Raw key from DB:', rawKeyFromDb);
    // Replace escaped newlines with actual newlines
    const privateKeyPem = rawKeyFromDb.replace(/\\n/g, '\n');
    console.log('Private key PEM:', privateKeyPem);
    // Generate privateKey from PEM string
    const privateKey = PrivateKey.fromPem(privateKeyPem);
    // Sign the message
    const signature = Ecdsa.sign(message, privateKey);
    // Convert to base64
    return signature.toBase64();
  } catch (error) {
    console.error('Error in sign:', error);
    throw error;
  }
}
export async function verify(message, signature, publicKey) {
  try {
    // Replace escaped newlines with actual newlines
    const publicKeyPem = publicKey.replace(/\\n/g, '\n');
    // Generate publicKey from PEM string
    const key = PrivateKey.fromPem(publicKeyPem).publicKey();
    // Verify the signature
    return Ecdsa.verify(message, signature, key);
  } catch (error) {
    console.error('Error in verify:', error);
    return false;
  }
}
