
// utils/sandbox.js
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { parseInputToTypes, mapJsTypeToJava } from './codeGenUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

// Ensure the base temp directory exists on startup
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// --- BATCH EXECUTION (for Submissions) ---

/**
 * Orchestrates batch execution for any supported language.
 * This is the primary function for the 'Submit' feature.
 * It creates a single sandboxed process per submission and runs all test cases within it.
 */
const executeAllTestCases = (language, code, testCases) => {
    switch (language) {
        case 'javascript':
            return executeJavaScriptAll(code, testCases);
        case 'python':
            return executePythonAll(code, testCases);
        case 'java':
            return executeJavaAll(code, testCases);
        default:
            return Promise.reject(new Error(`Language ${language} not supported for batch execution.`));
    }
};

/**
 * Executes all JavaScript test cases in a single Node.js process.
 * The user's code and a driver script are written to a temp file.
 * All test case inputs are passed as a JSON string via command-line arguments.
 * The script loops through inputs, executes the user's 'solve' function for each,
 * and prints a single JSON array of results to stdout.
 */
const executeJavaScriptAll = (code, testCases) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const allInputs = JSON.stringify(testCases.map(t => t.input));
        const BATCH_TIMEOUT = 15000; // 15 seconds for all test cases

        const wrappedCode = `
            ${code} // User's solution code is injected here.

            // Driver code to run all test cases in a single process.
            (async () => {
                try {
                    if (typeof solve !== 'function') {
                        throw new Error("A 'solve' function was not found.");
                    }
                    const allTestInputsStr = process.argv[2];
                    const allTestInputs = JSON.parse(allTestInputsStr);
                    const results = [];

                    for (const rawInput of allTestInputs) {
                        try {
                            const funcInput = JSON.parse(\`[\${rawInput}]\`);
                            const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput);
                            const output = typeof result === 'undefined' ? 'null' : JSON.stringify(result);
                            results.push({ success: true, output });
                        } catch (e) {
                            results.push({ success: false, error: e.name + ": " + e.message });
                        }
                    }
                    console.log(JSON.stringify(results)); // Final output
                } catch (e) {
                    console.error("Execution Engine Error: " + e.message);
                    process.exit(1);
                }
            })();
        `;
        handleBatchProcess('node', [tempFilePath, allInputs], wrappedCode, tempFilePath, BATCH_TIMEOUT, resolve, reject);
    });
};

/**
 * Executes all Python test cases in a single Python process.
 * The mechanism is identical to the JavaScript runner: write a single script,
 * pass all inputs via command-line, loop internally, and print one JSON result array.
 */
const executePythonAll = (code, testCases) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const allInputs = JSON.stringify(testCases.map(t => t.input));
        const BATCH_TIMEOUT = 15000; // 15 seconds

        const wrappedCode = `
import sys
import json
import traceback

${code} # User's solution code

def run_all_tests():
    try:
        if 'solve' not in globals():
            raise NameError("A 'solve' function was not found.")

        all_inputs_str = sys.argv[1]
        all_test_inputs = json.loads(all_inputs_str)
        results = []

        for raw_input in all_test_inputs:
            try:
                func_input = json.loads(f"[{raw_input}]")
                result = solve(*func_input) if isinstance(func_input, list) else solve(func_input)
                results.append({"success": True, "output": json.dumps(result)})
            except Exception as e:
                # Include traceback for better debugging
                error_info = traceback.format_exc()
                results.append({"success": False, "error": str(e) + '\\n' + error_info})
        
        print(json.dumps(results))

    except Exception as e:
        print(f"Execution Engine Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
        `;
        handleBatchProcess('python3', [tempFilePath, allInputs], wrappedCode, tempFilePath, BATCH_TIMEOUT, resolve, reject);
    });
};


/**
 * Compiles Java code once, then executes it in a single JVM instance for all test cases.
 * This is the fastest method, as it avoids the high overhead of starting a new JVM for each test case.
 */
const executeJavaAll = async (code, testCases) => {
    const uniqueId = nanoid(8);
    const execDir = path.join(tempDir, uniqueId);
    const BATCH_TIMEOUT = 15000; // 15 seconds

    try {
        await fs.mkdir(execDir, { recursive: true });
        const className = `Main`;
        const javaFile = `${className}.java`;
        const javaFilePath = path.join(execDir, javaFile);

        if (!Array.isArray(testCases) || testCases.length === 0) throw new Error('No test cases for Java.');
        
        const firstTestCase = testCases[0];
        const inputTypes = parseInputToTypes(firstTestCase.input);
        const outputType = parseInputToTypes(firstTestCase.output);
        let argParsingLogic = '';
        let argNames = [];

        if (!inputTypes) throw new Error("Could not determine Java input types.");
        
        inputTypes.forEach((type, i) => {
            const javaType = mapJsTypeToJava(type);
            const argName = `arg${i + 1}`;
            argNames.push(argName);
            
            switch(javaType) {
                case "int": argParsingLogic += `int ${argName}=Integer.parseInt(inputs[${i}]);`; break;
                case "String":
                    argParsingLogic += `String ${argName}=inputs[${i}]; if(${argName}.startsWith("\\"")&&${argName}.endsWith("\\""))${argName}=${argName}.substring(1,${argName}.length()-1);`;
                    break;
                case "int[]":
                    argParsingLogic += `String[] ${argName}_parts=inputs[${i}].replaceAll("[\\\\[\\\\] ]","").split(",");`;
                    argParsingLogic += `int[] ${argName}=new int[${argName}_parts.length==1&&${argName}_parts[0].isEmpty()?0:${argName}_parts.length];`;
                    argParsingLogic += `if(${argName}.length>0){for(int j=0;j<${argName}_parts.length;j++)${argName}[j]=Integer.parseInt(${argName}_parts[j]);}`;
                    break;
                default: argParsingLogic += `String ${argName}=inputs[${i}];`;
            }
        });
        
        const returnType = outputType ? mapJsTypeToJava(outputType[0]) : 'void';
        let callAndPrintLogic;
        if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')}); out.println("null");`;
        else if (returnType.includes("[]")) callAndPrintLogic = `out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
        else if (returnType === 'String') callAndPrintLogic = `out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
        else callAndPrintLogic = `out.println(s.solve(${argNames.join(',')}));`;
        
        const nestedSolutionCode = code.replace("class Solution", "static class Solution");
        const wrappedCode = `
import java.util.*;
import java.util.regex.Pattern;
import java.io.*;
public class ${className} {
    ${nestedSolutionCode}
    public static void main(String[] args) {
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out=new PrintWriter(System.out);
        String line;
        final String DELIMITER="|||";
        try {
            while ((line=reader.readLine())!=null) {
                try {
                    String[] inputs=line.split(Pattern.quote(DELIMITER));
                    ${argParsingLogic}
                    Solution s=new Solution();
                    ${callAndPrintLogic}
                } catch (Exception e) {
                    StringWriter sw=new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    out.println("ERROR:"+sw.toString());
                }
            }
            out.flush();
        } catch (IOException e) { e.printStackTrace(System.err); }
    }
}`;
        await fs.writeFile(javaFilePath, wrappedCode);

        // --- Compile Once ---
        await new Promise((resolve, reject) => {
            const compiler = spawn('javac', ['-Xlint:none', javaFilePath]);
            let compileError = '';
            compiler.stderr.on('data', (data) => compileError += data.toString());
            compiler.on('close', (code) => code !== 0 ? reject(new Error(`Compilation Error:\n${compileError || 'javac failed'}`)) : resolve());
            compiler.on('error', (err) => reject(err));
        });

        // --- Run Once with All Inputs via Stdin ---
        const runner = spawn('java', ['-cp', execDir, className], { timeout: BATCH_TIMEOUT });
        let stdout = '', stderr = '';
        runner.stdout.on('data', (data) => stdout += data.toString());
        runner.stderr.on('data', (data) => stderr += data.toString());
        
        const DELIMITER = "|||";
        const allInputsTogether = testCases.map(t => JSON.parse(`[${t.input}]`).join(DELIMITER)).join('\n');
        runner.stdin.write(allInputsTogether);
        runner.stdin.end();

        return new Promise((resolve, reject) => {
            runner.on('close', async () => {
                await cleanupPath(execDir);
                if (stderr) return reject(new Error(`Java Runtime Error: ${stderr}`));
                const outputs = stdout.trim().split('\n');
                const results = outputs.map(output => output.startsWith('ERROR:') ? { success: false, error: output.substring(6) } : { success: true, output });
                resolve(results);
            });
             runner.on('error', async (err) => { await cleanupPath(execDir); reject(err); });
        });
    } catch (error) {
        await cleanupPath(execDir).catch(() => {});
        throw error;
    }
};

const handleBatchProcess = async (command, args, code, tempFilePath, timeout, resolve, reject) => {
    try {
        await fs.writeFile(tempFilePath, code);
        const child = spawn(command, args, { timeout });
        let stdout = '', stderr = '';
        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());
        child.on('close', async () => {
            await cleanupPath(tempFilePath);
            if (stderr) reject(new Error(`Execution failed: ${stderr.trim()}`));
            else try { resolve(JSON.parse(stdout.trim())); } catch (e) { reject(new Error('Failed to parse execution results. Output: ' + stdout)); }
        });
        child.on('error', async (err) => { await cleanupPath(tempFilePath); reject(new Error(`Execution error: ${err.message}`)); });
    } catch (error) {
        reject(new Error(`Failed to write or execute script: ${error.message}`));
    }
};

// --- SINGLE EXECUTION (for "Run Code" button) ---

const executeCode = (language, code, input, problemTitle, allTestCases) => {
    switch (language) {
        case 'javascript': return executeJavaScript(code, input);
        case 'python': return executePython(code, input);
        case 'java': return executeJava(code, input, allTestCases);
        default: return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
    }
};

const executeJavaScript = (code, input) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const wrappedInput = `[${input}]`;
        const wrappedCode = `try { ${code} if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); } const funcInput = JSON.parse(process.argv[2]); const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput); const output = typeof result === 'undefined' ? 'null' : JSON.stringify(result); console.log(output); } catch (e) { console.error(e.name + ": " + e.message); }`;
        try {
            await fs.writeFile(tempFilePath, wrappedCode);
            const child = spawn('node', [tempFilePath, wrappedInput], { timeout: 5000 });
            handleChildProcess(child, tempFilePath, resolve, reject);
        } catch (error) {
            reject({ type: 'error', message: `Failed to write or execute script: ${error.message}` });
        }
    });
};

const executePython = (code, input) => {
     return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const wrappedInput = `[${input}]`;
        const wrappedCode = `import sys\nimport json\n\n${code}\n\ndef main():\n    try:\n        if 'solve' not in globals():\n            raise NameError(\"A 'solve' function was not found.\")\n        func_input = json.loads(sys.argv[1])\n        result = solve(*func_input) if isinstance(func_input, list) else solve(func_input)\n        print(json.dumps(result))\n    except Exception as e:\n        print(str(e), file=sys.stderr)\n\nif __name__ == \"__main__\":\n    main()`;
        try {
            await fs.writeFile(tempFilePath, wrappedCode);
            const child = spawn('python3', [tempFilePath, wrappedInput], { timeout: 5000 });
            handleChildProcess(child, tempFilePath, resolve, reject);
        } catch (error) {
            reject({ type: 'error', message: `Failed to write or execute script: ${error.message}` });
        }
    });
};

const executeJava = (code, input, allTestCases) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const execDir = path.join(tempDir, uniqueId);
        try {
            await fs.mkdir(execDir, { recursive: true });
            const className = `Main`;
            const javaFile = `${className}.java`;
            const javaFilePath = path.join(execDir, javaFile);
            let argParsingLogic = '', argNames = [];
            const spawnArgs = JSON.parse(`[${input}]`);
            if (allTestCases && Array.isArray(allTestCases) && allTestCases.length > 0) {
                const inputTypes = parseInputToTypes(allTestCases[0].input);
                if (inputTypes) {
                    inputTypes.forEach((type, i) => {
                         const javaType = mapJsTypeToJava(type), argName = `arg${i+1}`; argNames.push(argName);
                        switch(javaType) {
                            case "int": argParsingLogic += `int ${argName}=Integer.parseInt(args[${i}]);`; break;
                            case "String": argParsingLogic += `String ${argName}=args[${i}]; if(${argName}.startsWith("\\"")&&${argName}.endsWith("\\""))${argName}=${argName}.substring(1,${argName}.length()-1);`; break;
                            case "int[]": argParsingLogic += `String[] ${argName}_parts=args[${i}].replaceAll("[\\\\[\\\\] ]","").split(","); int[] ${argName}=new int[${argName}_parts.length==1&&${argName}_parts[0].isEmpty()?0:${argName}_parts.length]; if(${argName}.length>0){for(int j=0;j<${argName}_parts.length;j++)${argName}[j]=Integer.parseInt(${argName}_parts[j]);}`; break;
                            default: argParsingLogic += `String ${argName}=args[${i}];`;
                        }
                    });
                } else spawnArgs.forEach((_, i) => { const argName = `arg${i+1}`; argNames.push(argName); argParsingLogic += `String ${argName}=args[${i}];`; });
            } else spawnArgs.forEach((_, i) => { const argName = `arg${i+1}`; argNames.push(argName); argParsingLogic += `String ${argName}=args[${i}];`; });
            let returnType = 'void';
            if (allTestCases && allTestCases.length > 0) returnType = parseInputToTypes(allTestCases[0].output) ? mapJsTypeToJava(parseInputToTypes(allTestCases[0].output)[0]) : 'void';
            let callAndPrintLogic;
            if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')});`;
            else if (returnType.includes("[]")) callAndPrintLogic = `System.out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
            else if (returnType === 'String') callAndPrintLogic = `System.out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
            else callAndPrintLogic = `System.out.println(s.solve(${argNames.join(',')}));`;
            const wrappedCode = `import java.util.*;\nimport java.io.*;\npublic class ${className} { ${code.replace("class Solution", "static class Solution")} public static void main(String[] args) { try { ${argParsingLogic} Solution s=new Solution(); ${callAndPrintLogic} } catch (Exception e) { e.printStackTrace(); } } }`;
            await fs.writeFile(javaFilePath, wrappedCode);
            const compiler = spawn('javac', ['-Xlint:none', javaFilePath]);
            let compileError = '';
            compiler.stderr.on('data', (data) => compileError += data.toString());
            compiler.on('close', (compileCode) => {
                if (compileCode !== 0) handleChildProcess(null, execDir, resolve, reject, new Error(`Compilation Error:\n${compileError}`));
                else {
                    const runner = spawn('java', ['-cp', execDir, className, ...spawnArgs.map(String)], { timeout: 5000 });
                    handleChildProcess(runner, execDir, resolve, reject);
                }
            });
        } catch (error) {
            handleChildProcess(null, execDir, resolve, reject, error);
        }
    });
};

const handleChildProcess = (child, fileOrDirPath, resolve, reject, initialError = null) => {
    const cleanup = () => cleanupPath(fileOrDirPath);
    if (initialError) {
        cleanup().then(() => reject({ type: 'error', message: initialError.message }));
        return;
    }
    let stdout = '', stderr = '';
    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());
    child.on('close', () => cleanup().then(() => stderr ? reject({ type: 'error', message: stderr.trim() }) : resolve({ type: 'success', output: stdout.trim() })));
    child.on('error', (err) => cleanup().then(() => reject({ type: 'error', message: `Execution error: ${err.message}` })));
};

// --- UTILITY HELPERS ---

const cleanupPath = async (fileOrDirPath) => {
    try {
        await fs.rm(fileOrDirPath, { recursive: true, force: true });
    } catch (error) {
        if (error.code !== 'ENOENT') {
            // console.error("Cleanup failed:", error);
        }
    }
};

export { executeCode, executeAllTestCases };