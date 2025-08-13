// import { spawn } from 'child_process';
// import fs from 'fs/promises';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { nanoid } from 'nanoid';
// import { parseInputToTypes, mapJsTypeToJava } from './codeGenUtils.js';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const tempDir = path.join(__dirname, 'temp');

// fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// const executeCode = (language, code, input, problemTitle, allTestCases) => {
//     switch (language) {
//         case 'javascript':
//             return executeJavaScript(code, input);
//         case 'python':
//             return executePython(code, input);
//         case 'java':
//             return executeJava(code, input, allTestCases);
//         default:
//             return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
//     }
// };

// const executeJavaScript = (code, input) => {
//     return new Promise(async (resolve, reject) => {
//         const uniqueId = nanoid(8);
//         const tempFileName = `script-${uniqueId}.js`;
//         const tempFilePath = path.join(tempDir, tempFileName);
//         const wrappedInput = `[${input}]`;
//         const wrappedCode = `try { ${code} if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); } const funcInput = JSON.parse(process.argv[2]); const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput); const output = typeof result === 'string' ? JSON.stringify(result) : JSON.stringify(result); console.log(output); } catch (e) { console.error(e.name + ": " + e.message); }`;
//         await fs.writeFile(tempFilePath, wrappedCode);
//         const child = spawn('node', [tempFilePath, wrappedInput], { timeout: 5000 });
//         handleChildProcess(child, tempFilePath, resolve, reject);
//     });
// };

// const executePython = (code, input) => {
//      return new Promise(async (resolve, reject) => {
//         const uniqueId = nanoid(8);
//         const tempFileName = `script-${uniqueId}.py`;
//         const tempFilePath = path.join(tempDir, tempFileName);
//         const wrappedInput = `[${input}]`;
//         const wrappedCode = `import sys\nimport json\n\n${code}\n\ndef main():\n    try:\n        if 'solve' not in globals():\n            raise NameError("A 'solve' function was not found.")\n        func_input = json.loads(sys.argv[1])\n        if isinstance(func_input, list):\n            result = solve(*func_input)\n        else:\n            result = solve(func_input)\n        print(json.dumps(result))\n    except Exception as e:\n        print(str(e), file=sys.stderr)\n\nif __name__ == "__main__":\n    main()`;
//         await fs.writeFile(tempFilePath, wrappedCode);
//         const child = spawn('python', [tempFilePath, wrappedInput], { timeout: 5000 });
//         handleChildProcess(child, tempFilePath, resolve, reject);
//     });
// };

// const executeJava = (code, input, allTestCases) => {
//     return new Promise(async (resolve, reject) => {
//         // --- FIX: Create a unique directory for each execution for isolation ---
//         const uniqueId = nanoid(8);
//         const execDir = path.join(tempDir, uniqueId);
//         await fs.mkdir(execDir, { recursive: true });

//         const className = `Main`; // Standardize class name within its own folder
//         const javaFile = `${className}.java`;
//         const javaFilePath = path.join(execDir, javaFile);

//         try {
//             if (!allTestCases || allTestCases.length === 0) {
//                 throw new Error('Cannot generate Java runner without test cases.');
//             }
            
//             const firstTestCase = allTestCases[0];
//             const inputTypes = parseInputToTypes(firstTestCase.input);
//             const outputType = parseInputToTypes(firstTestCase.output);
//             if (!inputTypes) {
//                 throw new Error('Could not determine input types from the first test case.');
//             }
            
//             let argParsingLogic = '';
//             let argNames = [];
//             let spawnArgs = JSON.parse(`[${input}]`);

//             for (let i = 0; i < inputTypes.length; i++) {
//                 const javaType = mapJsTypeToJava(inputTypes[i]);
//                 const argName = `arg${i + 1}`;
//                 argNames.push(argName);
                
//                 switch(javaType) {
//                     case "int": argParsingLogic += `int ${argName}=Integer.parseInt(args[${i}]);`; break;
//                     case "String":
//                         argParsingLogic += `String ${argName}=args[${i}];`;
//                         argParsingLogic += `if(${argName}.startsWith("\\"")&&${argName}.endsWith("\\""))${argName}=${argName}.substring(1,${argName}.length()-1);`;
//                         break;
//                     case "int[]":
//                         argParsingLogic += `String[] ${argName}_parts=args[${i}].replaceAll("[\\\\[\\\\] ]","").split(",");`;
//                         argParsingLogic += `int[] ${argName}=new int[${argName}_parts.length==1&&${argName}_parts[0].isEmpty()?0:${argName}_parts.length];`;
//                         argParsingLogic += `if(${argName}.length>0){for(int j=0;j<${argName}_parts.length;j++)${argName}[j]=Integer.parseInt(${argName}_parts[j]);}`;
//                         break;
//                     default: argParsingLogic += `String ${argName}=args[${i}];`;
//                 }
//             }
            
//             const returnType = outputType ? mapJsTypeToJava(outputType[0]) : 'void';
//             let callAndPrintLogic;
//             if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')});`;
//             else if (returnType.includes("[]")) callAndPrintLogic = `System.out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
//             else if (returnType === 'String') callAndPrintLogic = `System.out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
//             else callAndPrintLogic = `System.out.println(s.solve(${argNames.join(',')}));`;

//             const nestedSolutionCode = code.replace("class Solution", "static class Solution");
//             const mainMethod = `public static void main(String[] args){try{${argParsingLogic}Solution s=new Solution();${callAndPrintLogic}}catch(Exception e){e.printStackTrace();}}`;
//             const wrappedCode = `import java.util.*;import java.io.*;public class ${className}{${nestedSolutionCode}${mainMethod}}`;
            
//             await fs.writeFile(javaFilePath, wrappedCode);

//             const compiler = spawn('javac', ['-Xlint:none', javaFilePath]);
//             let compileError = '';
//             compiler.stderr.on('data', (data) => { compileError += data.toString(); });
            
//             compiler.on('close', (compileCode) => {
//                 if (compileCode !== 0) {
//                     return reject({ type: 'error', message: `Compilation Error:\n${compileError}` });
//                 }
//                 const runner = spawn('java', ['-cp', execDir, className, ...spawnArgs.map(String)], { timeout: 5000 });
//                 handleChildProcess(runner, execDir, resolve, reject);
//             });
//         } catch (error) {
//             await handleChildProcess(null, execDir, resolve, reject, error);
//         }
//     });
// };

// const handleChildProcess = (child, dirToClean, resolve, reject, initialError = null) => {
//     // This cleanup function will now always run, even if the process fails to spawn
//     const cleanup = async () => {
//         try {
//             await fs.rm(dirToClean, { recursive: true, force: true });
//         } catch (error) {
//             // Non-critical, just log it
//         }
//     };
    
//     if (initialError) {
//         cleanup().then(() => reject({ type: 'error', message: initialError.message }));
//         return;
//     }

//     let stdout = '';
//     let stderr = '';
//     child.stdout.on('data', (data) => { stdout += data.toString(); });
//     child.stderr.on('data', (data) => { stderr += data.toString(); });

//     child.on('close', async () => {
//         await cleanup();
//         if (stderr) {
//             reject({ type: 'error', message: stderr.trim() });
//         } else {
//             resolve({ type: 'success', output: stdout.trim() });
//         }
//     });

//      child.on('error', async (err) => {
//         await cleanup();
//         reject({ type: 'error', message: `Execution error: ${err.message}` });
//     });
// }

// export { executeCode };

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { parseInputToTypes, mapJsTypeToJava } from './codeGenUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, 'temp');

// Ensure the base temp directory exists on startup
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

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
        const wrappedCode = `import sys\nimport json\n\n${code}\n\ndef main():\n    try:\n        if 'solve' not in globals():\n            raise NameError("A 'solve' function was not found.")\n        func_input = json.loads(sys.argv[1])\n        if isinstance(func_input, list):\n            result = solve(*func_input)\n        else:\n            result = solve(func_input)\n        print(json.dumps(result))\n    except Exception as e:\n        print(str(e), file=sys.stderr)\n\nif __name__ == "__main__":\n    main()`;
        
        try {
            await fs.writeFile(tempFilePath, wrappedCode);
            const child = spawn('python', [tempFilePath, wrappedInput], { timeout: 5000 });
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

            if (!allTestCases || allTestCases.length === 0) {
                throw new Error('Cannot generate Java runner without test cases.');
            }
            
            const firstTestCase = allTestCases[0];
            const inputTypes = parseInputToTypes(firstTestCase.input);
            const outputType = parseInputToTypes(firstTestCase.output);

            if (!inputTypes) {
                throw new Error('Could not determine input types from the first test case.');
            }
            
            let argParsingLogic = '';
            let argNames = [];
            let spawnArgs = JSON.parse(`[${input}]`);

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
            
            const returnType = outputType ? mapJsTypeToJava(outputType[0]) : 'void';
            let callAndPrintLogic;
            if (returnType === 'void') callAndPrintLogic = `s.solve(${argNames.join(',')});`;
            else if (returnType.includes("[]")) callAndPrintLogic = `System.out.println(java.util.Arrays.toString(s.solve(${argNames.join(',')})).replaceAll(" ",""));`;
            else if (returnType === 'String') callAndPrintLogic = `System.out.println("\\""+s.solve(${argNames.join(',')})+"\\"");`;
            else callAndPrintLogic = `System.out.println(s.solve(${argNames.join(',')}));`;

            const nestedSolutionCode = code.replace("class Solution", "static class Solution");
            
            // --- FIX: Use a clean, multi-line template for the generated Java code ---
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
                    // Pass the directory to clean up on compilation failure
                    handleChildProcess(null, execDir, resolve, reject, new Error(`Compilation Error:\n${compileError}`));
                } else {
                    const runner = spawn('java', ['-cp', execDir, className, ...spawnArgs.map(String)], { timeout: 5000 });
                    handleChildProcess(runner, execDir, resolve, reject);
                }
            });
        } catch (error) {
            // Pass the directory to clean up on any initial error
            handleChildProcess(null, execDir, resolve, reject, error);
        }
    });
};

const handleChildProcess = (child, fileOrDirPath, resolve, reject, initialError = null) => {
    const cleanup = async () => {
        try {
            const stats = await fs.stat(fileOrDirPath);
            if (stats.isDirectory()) {
                await fs.rm(fileOrDirPath, { recursive: true, force: true });
            } else {
                await fs.unlink(fileOrDirPath);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') { // Ignore if file/dir doesn't exist
                // console.error("Cleanup failed:", error);
            }
        }
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

export { executeCode };