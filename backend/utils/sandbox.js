// utils/sandbox.js
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { parseInputToTypes, mapJsTypeToJava } from './codeGenUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempRoot = path.join(__dirname, 'temp');
await fs.mkdir(tempRoot, { recursive: true }).catch(console.error);

const executeCode = (language, code, input, problemTitle, allTestCases) => {
    switch (language) {
        case 'javascript':
            return executeJavaScript(code, input);
        case 'python':
            return executePython(code, input);
        case 'java':
            return executeJava(code, input, allTestCases);
        default:
            return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
    }
};

const executeJavaScript = (code, input) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.js`;
        const tempFilePath = path.join(tempRoot, tempFileName);
        const wrappedInput = `[${input}]`;
        // wrap code and call solve(...)
        const wrappedCode = `try { ${code}
if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); }
const funcInput = JSON.parse(process.argv[2]);
const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput);
console.log(JSON.stringify(result));
} catch (e) { console.error(e.name + ": " + e.message); process.exit(1); }`;
        await fs.writeFile(tempFilePath, wrappedCode);
        const child = spawn('node', [tempFilePath, wrappedInput], { timeout: 5000 });
        handleChildProcess(child, uniqueId, resolve, reject, true);
    });
};

const executePython = (code, input) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const tempFileName = `script-${uniqueId}.py`;
        const tempFilePath = path.join(tempRoot, tempFileName);
        const wrappedInput = `[${input}]`;
        const wrappedCode = `import sys, json
${code}

def main():
    try:
        if 'solve' not in globals():
            raise NameError("A 'solve' function was not found.")
        func_input = json.loads(sys.argv[1])
        if isinstance(func_input, list):
            result = solve(*func_input)
        else:
            result = solve(func_input)
        print(json.dumps(result))
    except Exception as e:
        print(type(e).__name__ + ": " + str(e), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()`;
        await fs.writeFile(tempFilePath, wrappedCode);
        const child = spawn('python', [tempFilePath, wrappedInput], { timeout: 5000 });
        handleChildProcess(child, uniqueId, resolve, reject, true);
    });
};

const executeJava = (code, input, allTestCases) => {
    return new Promise(async (resolve, reject) => {
        const uniqueId = nanoid(8);
        const execDir = path.join(tempRoot, uniqueId);
        await fs.mkdir(execDir, { recursive: true });

        try {
            if (!allTestCases || allTestCases.length === 0) {
                await cleanupDir(execDir);
                return reject({ type: 'error', message: 'Cannot generate Java runner without test cases.' });
            }

            const firstTestCase = allTestCases[0];
            const inputTypes = parseInputToTypes(firstTestCase.input);
            const outputTypes = parseInputToTypes(firstTestCase.output);
            if (!inputTypes) {
                await cleanupDir(execDir);
                return reject({ type: 'error', message: 'Could not determine input types from the first test case.' });
            }

            // convert input string to actual args we pass to Java (strings that represent JSON values)
            let spawnArgs = [];
            try {
                spawnArgs = JSON.parse(`[${input}]`);
            } catch (e) {
                // if the input provided for a run is not valid JSON, try to fall back to raw split
                try {
                    spawnArgs = input.split(',').map(s => s.trim());
                } catch (e2) {
                    await cleanupDir(execDir);
                    return reject({ type: 'error', message: 'Invalid format for test case input.' });
                }
            }

            // build parsing logic and arg names
            let argParsingLogic = '';
            const argNames = [];
            for (let i = 0; i < inputTypes.length; i++) {
                const jsType = inputTypes[i];
                const javaType = mapJsTypeToJava(jsType);
                const argName = `arg${i + 1}`;
                argNames.push(argName);

                // we expect java program to receive args[] where each arg is a JSON-like string representation
                switch (javaType) {
                    case 'int':
                        argParsingLogic += `int ${argName} = Integer.parseInt(args[${i}]);\n`;
                        break;
                    case 'double':
                        argParsingLogic += `double ${argName} = Double.parseDouble(args[${i}]);\n`;
                        break;
                    case 'boolean':
                        argParsingLogic += `boolean ${argName} = Boolean.parseBoolean(args[${i}]);\n`;
                        break;
                    case 'String':
                        // strip surrounding quotes if present
                        argParsingLogic += `String ${argName} = args[${i}];\n`;
                        argParsingLogic += `${argName} = ${argName}.length()>1 && ${argName}.startsWith("\\"") && ${argName}.endsWith("\\"") ? ${argName}.substring(1, ${argName}.length()-1) : ${argName};\n`;
                        break;
                    case 'int[]':
                        argParsingLogic += `String raw${i} = args[${i}].trim();\n`;
                        argParsingLogic += `if(raw${i}.startsWith("[")) raw${i} = raw${i}.substring(1, raw${i}.length()-1);\n`;
                        argParsingLogic += `int[] ${argName} = raw${i}.isEmpty() ? new int[0] : java.util.Arrays.stream(raw${i}.split(",")).map(String::trim).filter(s->!s.isEmpty()).mapToInt(Integer::parseInt).toArray();\n`;
                        break;
                    case 'String[]':
                        argParsingLogic += `String raw${i} = args[${i}].trim();\n`;
                        argParsingLogic += `if(raw${i}.startsWith("[")) raw${i} = raw${i}.substring(1, raw${i}.length()-1);\n`;
                        // split on commas but keep items (basic splitting — accepts quoted or unquoted values)
                        argParsingLogic += `String[] ${argName} = raw${i}.isEmpty() ? new String[0] : java.util.Arrays.stream(raw${i}.split(\",\")).map(String::trim).map(s->(s.length()>1 && s.startsWith("\\"") && s.endsWith("\\""))? s.substring(1, s.length()-1): s).toArray(String[]::new);\n`;
                        break;
                    case 'boolean[]':
                        argParsingLogic += `String raw${i} = args[${i}].trim();\n`;
                        argParsingLogic += `if(raw${i}.startsWith("[")) raw${i} = raw${i}.substring(1, raw${i}.length()-1);\n`;
                        argParsingLogic += `boolean[] ${argName} = raw${i}.isEmpty() ? new boolean[0] : java.util.Arrays.stream(raw${i}.split(\",\")).map(String::trim).filter(s->!s.isEmpty()).mapToInt(s->Boolean.parseBoolean(s)?1:0).toArray();\n`;
                        // convert int[] to boolean[] manually
                        argParsingLogic += `if(${argName}.length>0) { boolean[] tmp = new boolean[${argName}.length]; for(int _i=0; _i<${argName}.length; _i++) tmp[_i] = ${argName}[_i] == 1; ${argName} = tmp; }\n`;
                        break;
                    default:
                        // fallback to String and let user's method convert/parse if needed
                        argParsingLogic += `String ${argName} = args[${i}];\n`;
                        argParsingLogic += `${argName} = ${argName}.length()>1 && ${argName}.startsWith("\\"") && ${argName}.endsWith("\\"") ? ${argName}.substring(1, ${argName}.length()-1) : ${argName};\n`;
                }
            }

            // determine return printing behavior
            const returnTypeJs = outputTypes && outputTypes.length > 0 ? outputTypes[0] : null;
            const returnType = mapJsTypeToJava(returnTypeJs);
            let callAndPrintLogic = '';
            // Create robust print logic:
            // - arrays -> Arrays.toString
            // - otherwise -> System.out.println(result)
            if (returnType && returnType.endsWith("[]")) {
                callAndPrintLogic = `${returnType} res = s.solve(${argNames.join(', ')});\nSystem.out.println(java.util.Arrays.toString(res).replaceAll(" ", ""));`;
            } else {
                // try to call and print; if void -> call only
                if (returnType === 'void') {
                    callAndPrintLogic = `s.solve(${argNames.join(', ')});`;
                } else {
                    callAndPrintLogic = `Object res = s.solve(${argNames.join(', ')});\nSystem.out.println(res);`;
                }
            }

            // Compose final class (we assume user's code defines class Solution with solve(...) method)
            const className = `Main_${uniqueId}`;
            const javaFile = `${className}.java`;
            const javaFilePath = path.join(execDir, javaFile);

            const mainMethod = `public static void main(String[] args) {
    try {
        ${argParsingLogic}
        Solution s = new Solution();
        ${callAndPrintLogic}
    } catch (Exception e) {
        e.printStackTrace();
        System.exit(1);
    }
}`;

            const wrappedCode = `import java.util.*;\nimport java.io.*;\n${code}\npublic class ${className} { ${mainMethod} }`;
            await fs.writeFile(javaFilePath, wrappedCode);

            // compile into execDir
            const compiler = spawn('javac', ['-d', execDir, javaFilePath]);
            let compileError = '';
            compiler.stderr.on('data', (data) => { compileError += data.toString(); });
            compiler.on('close', async (codeExit) => {
                if (codeExit !== 0) {
                    await cleanupDir(execDir);
                    return reject({ type: 'error', message: `Compilation Error:\n${compileError}` });
                }
                // run
                const runner = spawn('java', ['-cp', execDir, className, ...spawnArgs.map(String)], { timeout: 5000 });
                handleChildProcess(runner, uniqueId, resolve, reject, false, execDir);
            });

        } catch (err) {
            await cleanupDir(execDir);
            return reject({ type: 'error', message: err.message || String(err) });
        }
    });
};

const handleChildProcess = (child, uniqueId, resolve, reject, isSingleFile = true, execDir = null) => {
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', async (code) => {
        // cleanup: if execDir provided remove recursively, otherwise remove files that contain uniqueId
        try {
            if (execDir) {
                await cleanupDir(execDir);
            } else {
                // remove single temp files that include uniqueId in tempRoot
                const files = await fs.readdir(tempRoot);
                const filesToDelete = files.filter(f => f.includes(uniqueId));
                await Promise.all(filesToDelete.map(f => fs.unlink(path.join(tempRoot, f)).catch(()=>{})));
            }
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }

        if (code !== 0 || stderr) {
            // prefer stderr content
            const errMsg = (stderr && stderr.trim()) ? stderr.trim() : `Process exited with code ${code}`;
            return reject({ type: 'error', message: errMsg });
        }

        return resolve({ type: 'success', output: stdout.trim() });
    });

    child.on('error', async (err) => {
        if (execDir) await cleanupDir(execDir).catch(()=>{});
        reject({ type: 'error', message: `Execution error: ${err.message}` });
    });
};

const cleanupDir = async (dir) => {
    try {
        // Remove files then remove dir
        const entries = await fs.readdir(dir);
        await Promise.all(entries.map(e => fs.unlink(path.join(dir, e)).catch(()=>{})));
        await fs.rmdir(dir).catch(()=>{});
    } catch (e) {
        // best-effort
    }
};

export { executeCode };
