const toHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export const generateApiKey = () => "pl_" + toHex(crypto.getRandomValues(new Uint8Array(32)));

export const hashApiKey = async (key: string) => {
    return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))));
};
