// Chat-GPT generated code -- tested with its test suite

import * as crypto from 'crypto'

// Function to convert a Uint8Array to a URL-safe base64 string
function uint8ArrayToUrlSafeBase64(uint8Array: Uint8Array): string {
    const base64String = Buffer.from(uint8Array).toString('base64')
    return base64String
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

// Function to convert a URL-safe base64 string to a Uint8Array
function urlSafeBase64ToUint8Array(base64String: string): Uint8Array {
    const base64 = base64String.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const binaryString = Buffer.from(base64 + padding, 'base64').toString(
        'binary',
    )
    const uint8Array = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
    }
    return uint8Array
}

// Function to encrypt a JavaScript object and return a URL-safe base64 string
export async function encryptObj(obj: object, secret: string): Promise<string> {
    const textEncoder = new TextEncoder()
    const encodedData = textEncoder.encode(JSON.stringify(obj))
    const iv = crypto.randomBytes(12)
    const key = Buffer.from(secret, 'hex')
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([
        iv,
        cipher.update(encodedData),
        cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    const encryptedData = Buffer.concat([ciphertext, tag])
    return uint8ArrayToUrlSafeBase64(new Uint8Array(encryptedData))
}

// Function to decrypt an encrypted string and return the JavaScript object
export async function decryptObj(
    encryptedStr: string,
    secret: string,
): Promise<object | null> {
    try {
        const encryptedData = urlSafeBase64ToUint8Array(encryptedStr)
        const iv = encryptedData.slice(0, 12)
        const tag = encryptedData.slice(-16)
        const ciphertext = encryptedData.slice(12, -16)
        const key = Buffer.from(secret, 'hex')
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(tag)
        const decryptedData = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ])
        const decryptedText = new TextDecoder().decode(decryptedData)
        return JSON.parse(decryptedText)
    } catch (error) {
        console.error('decryption error - old cookie?')
        // console.error('Decryption error:', error);
        return null
    }
}

export const checkSecret = (secret: string): boolean => {
    const key = Buffer.from(secret, 'hex')
    return Buffer.byteLength(key) == 32
}
/*****  test code

  // Example usage:
  const secretKey = 'YourSecretKey';
  
  const originalObj = {
    username: 'JohnDoe',
    email: 'johndoe@example.com',
  };
  
  encryptObj(originalObj, secretKey)
    .then((encryptedString) => {
      console.log('Encrypted String:', encryptedString);
      return decryptObj(encryptedString, secretKey);
    })
    .then((decryptedObj) => {
      console.log('Decrypted Object:', decryptedObj);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
  
****/
