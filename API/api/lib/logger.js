import { getOptionalEnv } from './env.js';
const levelWeight = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};
function getConfiguredLevel() {
    const value = getOptionalEnv('LOG_LEVEL')?.toLowerCase();
    if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
        return value;
    }
    return 'info';
}
function shouldLog(level) {
    return levelWeight[level] >= levelWeight[getConfiguredLevel()];
}
function serializeError(error) {
    if (!(error instanceof Error)) {
        return error;
    }
    return {
        name: error.name,
        message: error.message,
        stack: error.stack
    };
}
function write(level, event, context) {
    if (!shouldLog(level)) {
        return;
    }
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        event,
        ...(context ?? {})
    };
    const line = JSON.stringify(payload);
    if (level === 'error') {
        console.error(line);
        return;
    }
    if (level === 'warn') {
        console.warn(line);
        return;
    }
    console.log(line);
}
export const logger = {
    debug(event, context) {
        write('debug', event, context);
    },
    info(event, context) {
        write('info', event, context);
    },
    warn(event, context) {
        write('warn', event, context);
    },
    error(event, error, context) {
        write('error', event, {
            ...(context ?? {}),
            error: serializeError(error)
        });
    }
};
