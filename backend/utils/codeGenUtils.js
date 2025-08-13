// utils/codeGenUtils.js
export const detectType = (value) => {
    if (value === null) return 'null';
    const t = typeof value;
    if (t !== 'object') {
        if (t === 'number') {
            // treat all numbers as 'number' (mapped later to int/double as needed)
            return 'number';
        }
        return t;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return 'any[]';
        // detect type from first element (best-effort)
        const inner = detectType(value[0]);
        return `${inner}[]`;
    }
    return 'object';
};

export const parseInputToTypes = (inputStr) => {
    // inputStr expected to be a comma-separated list of JSON values e.g.:
    // "1, 2", "\"abc\", [1,2]", "[1,2], \"x\""
    if (!inputStr || inputStr.trim() === '') return null;
    try {
        // Put square brackets around to be valid JSON array
        const parsed = JSON.parse(`[${inputStr}]`);
        if (!Array.isArray(parsed)) return null;
        return parsed.map(detectType);
    } catch (e) {
        // if JSON.parse fails, fallback best-effort: split by comma (not ideal)
        // but avoid crashing — return null to let caller handle a fallback.
        return null;
    }
};

export const mapJsTypeToJava = (jsType) => {
    if (!jsType) return 'Object';
    const mapping = {
        'number': 'int',         // assume integer by default
        'string': 'String',
        'boolean': 'boolean',
        'number[]': 'int[]',
        'string[]': 'String[]',
        'boolean[]': 'boolean[]',
        'number[][]': 'int[][]',
        'string[][]': 'String[][]',
        'any[]': 'Object[]',
        'object': 'Object',
        'null': 'Object',
    };
    // allow array-of-any e.g. 'object[]' -> Object[]
    if (jsType.endsWith('[]') && !mapping[jsType]) {
        return 'Object[]';
    }
    return mapping[jsType] || 'Object';
};
