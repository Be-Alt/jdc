export function getEnv(name, fallback) {
    const value = process.env[name]?.trim();
    if (value) {
        return value;
    }
    if (fallback !== undefined) {
        return fallback;
    }
    throw new Error(`Missing required environment variable: ${name}`);
}
export function getOptionalEnv(name) {
    const value = process.env[name]?.trim();
    return value || undefined;
}
