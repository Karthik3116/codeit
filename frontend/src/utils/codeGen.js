/**
 * This utility file contains the logic for parsing test case inputs
 * and dynamically generating starter code templates.
 */

/**
 * Detects the type of a JavaScript value and returns a string representation.
 * e.g., 123 -> "number", ["a"] -> "string[]"
 */
const detectType = (value) => {
    if (typeof value !== 'object' || value === null) {
        return typeof value;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return 'any[]';
        // Check the type of the first element to determine the array type
        const arrayType = detectType(value[0]);
        return `${arrayType}[]`;
    }
    return 'object';
};

/**
 * Parses a test case input string into an array of type signatures.
 * e.g., '"hello", 123' -> ['string', 'number']
 */
export const parseInputToTypes = (inputStr) => {
    if (!inputStr || inputStr.trim() === '') return null;
    try {
        // Wrap the input in brackets to parse it as a valid JSON array
        const parsedInput = JSON.parse(`[${inputStr}]`);
        if (!Array.isArray(parsedInput)) return null;
        return parsedInput.map(detectType);
    } catch (e) {
        return null; // Return null if parsing fails
    }
};

/**
 * Converts a string to camelCase.
 * e.g., "Move Zeroes" -> "moveZeroes"
 */
const toCamelCase = (str) => {
    return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
            index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/\s+/g, '');
};

/**
 * Maps our JavaScript-detected types to Java types.
 */
const mapJsTypeToJava = (jsType) => {
    const mapping = {
        'number': 'int',
        'string': 'String',
        'boolean': 'boolean',
        'number[]': 'int[]',
        'string[]': 'String[]',
        'boolean[]': 'boolean[]',
        'number[][]': 'int[][]',
        'string[][]': 'String[][]',
    };
    return mapping[jsType] || 'Object';
};

/**
 * Generates the complete starter code array for all languages.
 */
export const generateStarterCode = (inputTypes, outputType, problemTitle) => {
    const argNames = inputTypes.map((_, i) => `arg${i + 1}`);

    // --- JavaScript ---
    const jsArgs = argNames.join(', ');
    const jsStarter = `function solve(${jsArgs}) {\n  // Your logic here\n}`;

    // --- Python ---
    const pyArgs = argNames.join(', ');
    // FIX: Replaced curly braces with a colon for correct Python syntax
    const pyStarter = `def solve(${pyArgs}):\n  # Your logic here\n  pass`;

    // --- Java ---
    // The method name is now always 'solve' for consistency
    const javaReturnType = outputType ? mapJsTypeToJava(outputType) : 'void';
    const javaArgs = inputTypes.map((type, i) => `${mapJsTypeToJava(type)} ${argNames[i]}`).join(', ');
    const javaStarter =
`

class Solution {
    public ${javaReturnType} solve(${javaArgs}) {
        // Your logic here
    }
}`;

    return [
        { language: 'javascript', code: jsStarter },
        { language: 'python', code: pyStarter },
        { language: 'java', code: javaStarter },
    ];
};