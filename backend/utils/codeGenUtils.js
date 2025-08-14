
// utils/codeGenUtils.js
export const detectType = (value) => {
    if (value === null) return 'null';
    const t = typeof value;
    if (t !== 'object') {
        if (t === 'number') {
            return 'number';
        }
        return t;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return 'any[]';
        const inner = detectType(value[0]);
        return `${inner}[]`;
    }
    return 'object';
};

export const parseInputToTypes = (inputStr) => {
    if (!inputStr || inputStr.trim() === '') return null;
    try {
        const parsed = JSON.parse(`[${inputStr}]`);
        if (!Array.isArray(parsed)) return null;
        return parsed.map(detectType);
    } catch (e) {
        return null;
    }
};

export const mapJsTypeToJava = (jsType) => {
    if (!jsType) return 'Object';
    const mapping = {
        'number': 'int',
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
    if (jsType.endsWith('[]') && !mapping[jsType]) {
        return 'Object[]';
    }
    return mapping[jsType] || 'Object';
};