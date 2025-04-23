// Polyfill Buffer for Deno
import { Buffer } from "https://deno.land/std@0.168.0/node/buffer.ts";
globalThis.Buffer = Buffer;
import { Ecdsa, PrivateKey } from 'https://esm.sh/starkbank-ecdsa@1.1.5';
export async function generateSignature(message, rawKeyFromDb) {
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
    console.error('Error in generateSignature:', error);
    throw error;
  }
}
