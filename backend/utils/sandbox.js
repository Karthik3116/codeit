import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, 'temp');

// Ensure temp directory exists
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

const executeCode = (language, code, input, problemTitle) => {
    switch (language) {
        case 'javascript':
            return executeJavaScript(code, input);
        case 'python':
            return executePython(code, input);
        case 'java':
            return executeJava(code, input, problemTitle);
        default:
            return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
    }
};

// --- JavaScript and Python Executors (Unchanged) ---
const executeJavaScript = (code, input) => {
    return new Promise(async (resolve, reject) => {
        const tempFileName = `code-${Date.now()}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const wrappedCode = `try{const mainFunction=(()=>{${code};if(typeof twoSum==='function')return twoSum;if(typeof isPalindrome==='function')return isPalindrome;if(typeof fib==='function')return fib;return null;})();if(mainFunction){const funcInput=JSON.parse(process.argv[2]);const result=Array.isArray(funcInput)?mainFunction(...funcInput):mainFunction(funcInput);console.log(JSON.stringify(result));}}catch(e){console.error(e.name+": "+e.message);}`;
        await fs.writeFile(tempFilePath, wrappedCode);
        const child = spawn('node', [tempFilePath, input], { timeout: 5000 });
        handleChildProcess(child, tempFilePath, resolve, reject);
    });
};
const executePython = (code, input) => {
     return new Promise(async (resolve, reject) => {
        const tempFileName = `script-${Date.now()}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);
        const wrappedCode = `import sys\nimport json\n${code}\ndef main():\n    try:\n        func_input=json.loads(sys.argv[1])\n        if 'two_sum' in globals():\n            result=two_sum(func_input[0],func_input[1])\n        elif 'is_palindrome' in globals():\n            result=is_palindrome(func_input)\n        elif 'fib' in globals():\n            result=fib(func_input)\n        else:\n            raise Exception("No valid solution function found")\n        print(json.dumps(result))\n    except Exception as e:\n        print(e,file=sys.stderr)\nif __name__=="__main__":\n    main()`;
        await fs.writeFile(tempFilePath, wrappedCode);
        const child = spawn('python', [tempFilePath, input], { timeout: 5000 });
        handleChildProcess(child, tempFilePath, resolve, reject);
    });
};

// --- Java Executor (Fully Rebuilt) ---
const executeJava = (code, input, problemTitle) => {
    return new Promise(async (resolve, reject) => {
        const javaFile = `Main.java`;
        const javaFilePath = path.join(tempDir, javaFile);
        const classPath = path.join(tempDir, `Main.class`);

        let mainMethod;
        let formattedInput = input;
        
        // Generate a specific main method based on the problem
        switch (problemTitle) {
            case "Palindrome Number":
                mainMethod = `
                    public static void main(String[] args) {
                        int input = Integer.parseInt(args[0]);
                        Solution s = new Solution();
                        System.out.println(s.isPalindrome(input));
                    }`;
                break;
            case "Two Sum":
                 // Reformat input from JSON to be command-line friendly for Java
                const parsedTwoSum = JSON.parse(input); // e.g., [[2,7,11,15], 9]
                const numsString = JSON.stringify(parsedTwoSum[0]).replace(/[\[\]]/g, '');
                const target = parsedTwoSum[1];
                formattedInput = `${numsString} ${target}`; // e.g., "2,7,11,15 9"
                mainMethod = `
                    public static void main(String[] args) {
                        String[] numsStr = args[0].split(",");
                        int[] nums = new int[numsStr.length];
                        for (int i = 0; i < numsStr.length; i++) {
                            nums[i] = Integer.parseInt(numsStr[i].trim());
                        }
                        int target = Integer.parseInt(args[1]);

                        Solution s = new Solution();
                        int[] result = s.twoSum(nums, target);
                        System.out.println(java.util.Arrays.toString(result).replaceAll(" ", ""));
                    }`;
                break;
            case "Fibonacci Number":
                mainMethod = `
                    public static void main(String[] args) {
                        int input = Integer.parseInt(args[0]);
                        Solution s = new Solution();
                        System.out.println(s.fib(input));
                    }`;
                break;
            default:
                return reject({ type: 'error', message: 'Could not generate Java runner for this problem.' });
        }

        const wrappedCode = `
            ${code}
            public class Main {
                ${mainMethod}
            }`;
        
        await fs.writeFile(javaFilePath, wrappedCode);

        // 1. Compile the code
        const compiler = spawn('javac', [javaFilePath]);
        let compileError = '';
        compiler.stderr.on('data', (data) => { compileError += data.toString(); });
        
        compiler.on('close', (code) => {
            if (code !== 0) {
                fs.unlink(javaFilePath).catch(()=>{});
                return reject({ type: 'error', message: `Compilation Error:\n${compileError}` });
            }

            // 2. Execute the compiled code
            const runner = spawn('java', ['-cp', tempDir, 'Main', ...formattedInput.split(' ')], { timeout: 5000 });
            handleChildProcess(runner, [javaFilePath, classPath], resolve, reject);
        });
    });
};

// --- Universal Process Handler (Unchanged) ---
const handleChildProcess = (child, filesToClean, resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', async () => {
        const cleanupPromises = (Array.isArray(filesToClean) ? filesToClean : [filesToClean])
            .map(file => fs.unlink(file).catch(()=>{}));
        await Promise.all(cleanupPromises);
        if (stderr) {
            reject({ type: 'error', message: stderr.trim() });
        } else {
            resolve({ type: 'success', output: stdout.trim() });
        }
    });
     child.on('error', async (err) => {
        const cleanupPromises = (Array.isArray(filesToClean) ? filesToClean : [filesToClean])
            .map(file => fs.unlink(file).catch(()=>{}));
        await Promise.all(cleanupPromises);
        reject({ type: 'error', message: `Execution error: ${err.message}` });
    });
}

export { executeCode };