
// utils/sandbox.js
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { parseInputToTypes, mapJsTypeToJava } from './codeGenUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp'); // move one level up so repo temp stable

// Ensure the base temp directory exists on startup
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

const executeCode = (language, code, input, problemTitle, allTestCases) => {
    switch (language) {
        case 'javascript':
            return executeJavaScript(code, input);
        case 'python':
            return executePython(code, input);
        case 'java':
            // keep backward compatible single-run behavior
            return executeJava(code, input, allTestCases);
        default:
            return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
    }
};

const executeJavaScript = (code, input) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const wrappedInput = `[${input}]`;
        const wrappedCode = `try { ${code} if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); } const funcInput = JSON.parse(process.argv[2]); const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput); const output = typeof result === 'string' ? JSON.stringify(result) : JSON.stringify(result); console.log(output); } catch (e) { console.error(e.name + ": " + e.message); }`;
        
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
        const wrappedCode = `import sys\nimport json\n\n${code}\n\ndef main():\n    try:\n        if 'solve' not in globals():\n            raise NameError(\"A 'solve' function was not found.\")\n        func_input = json.loads(sys.argv[1])\n        if isinstance(func_input, list):\n            result = solve(*func_input)\n        else:\n            result = solve(func_input)\n        print(json.dumps(result))\n    except Exception as e:\n        print(str(e), file=sys.stderr)\n\nif __name__ == \"__main__\":\n    main()`;
        
        try {
            await fs.writeFile(tempFilePath, wrappedCode);
            const child = spawn('python3', [tempFilePath, wrappedInput], { timeout: 5000 });
            handleChildProcess(child, tempFilePath, resolve, reject);
        } catch (error) {
            reject({ type: 'error', message: `Failed to write or execute script: ${error.message}` });
        }
    });
};

/**
 * executeJava: backward-compatible single-run Java execution.
 * When called, it compiles and runs the Java code once with given input.
 * Kept for runCode (ad-hoc single-run) compatibility.
 */
const executeJava = (code, input, allTestCases) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const execDir = path.join(tempDir, uniqueId);
        
        try {
            await fs.mkdir(execDir, { recursive: true });

            const className = `Main`;
            const javaFile = `${className}.java`;
            const javaFilePath = path.join(execDir, javaFile);

            // For single-run, attempt to use first testcase for type inference (if provided)
            let argParsingLogic = '';
            let argNames = [];

            // If allTestCases present and non-empty, attempt to infer types from first test case
            if (allTestCases && Array.isArray(allTestCases) && allTestCases.length > 0) {
                const firstTestCase = allTestCases[0];
                const inputTypes = parseInputToTypes(firstTestCase.input);
                if (inputTypes) {
                    for (let i = 0; i < inputTypes.length; i++) {
                        const javaType = mapJsTypeToJava(inputTypes[i]);
                        const argName = `arg${i + 1}`;
                        argNames.push(argName);
                        
                        switch(javaType) {
                            case "int": argParsingLogic += `int ${argName}=Integer.parseInt(args[${i}]);`; break;
                            case "String":
                                argParsingLogic += `String ${argName}=args[${i}];`;
                                argParsingLogic += `if(${argName}.startsWith("\\"")&&${argName}.endsWith("\\""))${argName}=${argName}.substring(1,${argName}.length()-1);`;
                                break;
                            case "int[]":
                                argParsingLogic += `String[] ${argName}_parts=args[${i}].replaceAll("[\\\\[\\\\] ]","").split(",");`;
                                argParsingLogic += `int[] ${argName}=new int[${argName}_parts.length==1&&${argName}_parts[0].isEmpty()?0:${argName}_parts.length];`;
                                argParsingLogic += `if(${argName}.length>0){for(int j=0;j<${argName}_parts.length;j++)${argName}[j]=Integer.parseInt(${argName}_parts[j]);}`;
                                break;
                            default: argParsingLogic += `String ${argName}=args[${i}];`;
                        }
                    }
                } else {
                    // fallback: no type inference -> treat all args as String
                    const spawnArgs = JSON.parse(`[${input}]`);
                    for (let i = 0; i < spawnArgs.length; i++) {
                        const argName = `arg${i+1}`;
                        argNames.push(argName);
                        argParsingLogic += `String ${argName}=args[${i}];`;
                    }
                }
            } else {
                // fallback: build parsing based on provided input string
                const spawnArgs = JSON.parse(`[${input}]`);
                for (let i = 0; i < spawnArgs.length; i++) {
                    const argName = `arg${i+1}`;
                    argNames.push(argName);
                    argParsingLogic += `String ${argName}=args[${i}];`;
                }
            }

            // Determine rough return type from first test case output if possible
            let returnType = 'void';
            if (allTestCases && allTestCases.length > 0) {
                const outputType = parseInputToTypes(allTestCases[0].output);
                returnType = outputType ? mapJsTypeToJava(outputType[0]) : 'void';
            }

            let callAndPrintLogic;
            if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')});`;
            else if (returnType.includes("[]")) callAndPrintLogic = `System.out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
            else if (returnType === 'String') callAndPrintLogic = `System.out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
            else callAndPrintLogic = `System.out.println(s.solve(${argNames.join(',')}));`;

            const nestedSolutionCode = code.replace("class Solution", "static class Solution");

            const wrappedCode = `
import java.util.*;
import java.io.*;

public class ${className} {
    ${nestedSolutionCode}

    public static void main(String[] args) {
        try {
            ${argParsingLogic}
            Solution s = new Solution();
            ${callAndPrintLogic}
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}`;

            await fs.writeFile(javaFilePath, wrappedCode);

            const compiler = spawn('javac', ['-Xlint:none', javaFilePath]);
            let compileError = '';
            compiler.stderr.on('data', (data) => { compileError += data.toString(); });

            compiler.on('close', (compileCode) => {
                if (compileCode !== 0) {
                    // cleanup and reject
                    handleChildProcess(null, execDir, resolve, reject, new Error(`Compilation Error:\n${compileError}`));
                } else {
                    // run once using provided input
                    const spawnArgs = JSON.parse(`[${input}]`);
                    const runner = spawn('java', ['-cp', execDir, className, ...spawnArgs.map(String)], { timeout: 5000 });
                    handleChildProcess(runner, execDir, resolve, reject);
                }
            });
        } catch (error) {
            handleChildProcess(null, execDir, resolve, reject, error);
        }
    });
};

/**
 * executeJavaAll: compile once and run sequentially for all test cases.
 * Returns an array of { success: boolean, output: string, error?: string } preserving test case order.
 */
const executeJavaAll = async (code, testCases) => {
    const uniqueId = nanoid(8);
    const execDir = path.join(tempDir, uniqueId);

    const results = [];
    try {
        await fs.mkdir(execDir, { recursive: true });

        const className = `Main`;
        const javaFile = `${className}.java`;
        const javaFilePath = path.join(execDir, javaFile);

        // For batch mode, use the first test case to infer types and return type
        if (!Array.isArray(testCases) || testCases.length === 0) {
            throw new Error('No test cases provided for Java batch execution.');
        }

        const firstTestCase = testCases[0];
        const inputTypes = parseInputToTypes(firstTestCase.input);
        const outputType = parseInputToTypes(firstTestCase.output);

        if (!inputTypes) {
            // We can still proceed treating all args as String
            // But prefer to continue with fallback
        }

        let argParsingLogic = '';
        let argNames = [];
        if (inputTypes) {
            for (let i = 0; i < inputTypes.length; i++) {
                const javaType = mapJsTypeToJava(inputTypes[i]);
                const argName = `arg${i + 1}`;
                argNames.push(argName);
                
                switch(javaType) {
                    case "int": argParsingLogic += `int ${argName}=Integer.parseInt(args[${i}]);`; break;
                    case "String":
                        argParsingLogic += `String ${argName}=args[${i}];`;
                        argParsingLogic += `if(${argName}.startsWith("\\"")&&${argName}.endsWith("\\""))${argName}=${argName}.substring(1,${argName}.length()-1);`;
                        break;
                    case "int[]":
                        argParsingLogic += `String[] ${argName}_parts=args[${i}].replaceAll("[\\\\[\\\\] ]","").split(",");`;
                        argParsingLogic += `int[] ${argName}=new int[${argName}_parts.length==1&&${argName}_parts[0].isEmpty()?0:${argName}_parts.length];`;
                        argParsingLogic += `if(${argName}.length>0){for(int j=0;j<${argName}_parts.length;j++)${argName}[j]=Integer.parseInt(${argName}_parts[j]);}`;
                        break;
                    default: argParsingLogic += `String ${argName}=args[${i}];`;
                }
            }
        } else {
            // fallback: Use the first test case's input to determine arg count
            const spawnArgs = JSON.parse(`[${firstTestCase.input}]`);
            for (let i = 0; i < spawnArgs.length; i++) {
                const argName = `arg${i+1}`;
                argNames.push(argName);
                argParsingLogic += `String ${argName}=args[${i}];`;
            }
        }

        const returnType = outputType ? mapJsTypeToJava(outputType[0]) : 'void';
        let callAndPrintLogic;
        if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')});`;
        else if (returnType.includes("[]")) callAndPrintLogic = `System.out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
        else if (returnType === 'String') callAndPrintLogic = `System.out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
        else callAndPrintLogic = `System.out.println(s.solve(${argNames.join(',')}));`;

        const nestedSolutionCode = code.replace("class Solution", "static class Solution");

        const wrappedCode = `
import java.util.*;
import java.io.*;

public class ${className} {
    ${nestedSolutionCode}

    public static void main(String[] args) {
        try {
            ${argParsingLogic}
            Solution s = new Solution();
            ${callAndPrintLogic}
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}`;

        await fs.writeFile(javaFilePath, wrappedCode);

        // compile once
        const compileResult = await new Promise((resolveCompile, rejectCompile) => {
            const compiler = spawn('javac', ['-Xlint:none', javaFilePath]);
            let compileError = '';
            compiler.stderr.on('data', (data) => { compileError += data.toString(); });
            compiler.on('close', (code) => {
                if (code !== 0) rejectCompile(new Error(compileError || 'javac failed'));
                else resolveCompile();
            });
            compiler.on('error', (err) => rejectCompile(err));
        }).catch(async (err) => {
            await cleanupPath(execDir);
            throw new Error(`Compilation Error:\n${err.message}`);
        });

        // run sequentially for each test case to keep resource usage predictable
        for (let idx = 0; idx < testCases.length; idx++) {
            const t = testCases[idx];
            try {
                const spawnArgs = JSON.parse(`[${t.input}]`);
                const singleRun = await runJavaProcess(execDir, className, spawnArgs, 5000);
                if (singleRun.stderr && singleRun.stderr.trim().length > 0) {
                    results.push({ success: false, output: null, error: singleRun.stderr.trim() });
                } else {
                    results.push({ success: true, output: singleRun.stdout.trim() });
                }
            } catch (err) {
                results.push({ success: false, output: null, error: err.message });
            }
        }

        // cleanup
        await cleanupPath(execDir);
        return results;
    } catch (error) {
        // ensure cleanup on any failure
        await cleanupPath(execDir);
        throw error;
    }
};

const runJavaProcess = (execDir, className, argsArray, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
        try {
            const child = spawn('java', ['-cp', execDir, className, ...argsArray.map(String)], { timeout: timeoutMs });

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.stderr.on('data', (d) => { stderr += d.toString(); });

            child.on('close', (code) => {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
            });

            child.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
};

const cleanupPath = async (fileOrDirPath) => {
    try {
        const stats = await fs.stat(fileOrDirPath);
        if (stats.isDirectory()) {
            await fs.rm(fileOrDirPath, { recursive: true, force: true });
        } else {
            await fs.unlink(fileOrDirPath);
        }
    } catch (error) {
        // ignore ENOENT
        if (error.code !== 'ENOENT') {
            // console.error("Cleanup failed:", error);
        }
    }
};

const handleChildProcess = (child, fileOrDirPath, resolve, reject, initialError = null) => {
    const cleanup = async () => {
        await cleanupPath(fileOrDirPath);
    };
    
    if (initialError) {
        cleanup().then(() => reject({ type: 'error', message: initialError.message }));
        return;
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', async () => {
        await cleanup();
        if (stderr) {
            reject({ type: 'error', message: stderr.trim() });
        } else {
            resolve({ type: 'success', output: stdout.trim() });
        }
    });

     child.on('error', async (err) => {
        await cleanup();
        reject({ type: 'error', message: `Execution error: ${err.message}` });
    });
}

export { executeCode, executeJavaAll };
