
// utils/sandbox.js
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, '..', 'temp');

// persistent main compilation directories
const mainSrcDir = path.join(tempDir, 'main_src');
const mainBinDir = path.join(tempDir, 'main_bin');

// ensure base directories exist
const ensureDirs = async () => {
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(mainSrcDir, { recursive: true });
    await fs.mkdir(mainBinDir, { recursive: true });
  } catch (err) {
    console.error('Failed to ensure base directories:', err);
    throw err;
  }
};

const spawnPromise = (command, args, opts = {}) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, opts);
    let stdout = '', stderr = '';
    if (child.stdout) child.stdout.on('data', d => stdout += d.toString());
    if (child.stderr) child.stderr.on('data', d => stderr += d.toString());
    child.on('error', err => reject(err));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
};

// Lenient input parser for user-provided test-case input strings
const parseInputStringToArgs = (inputStr) => {
  if (inputStr === undefined || inputStr === null || inputStr === '') return [];
  try {
    return JSON.parse(`[${inputStr}]`);
  } catch (e) {
    try {
      return JSON.parse(`[${inputStr.replace(/'/g, '"')}]`);
    } catch (e2) {
      const tokens = [];
      let buf = '';
      let depth = 0;
      let inQuote = false;
      for (let i = 0; i < inputStr.length; i++) {
        const ch = inputStr[i];
        if ((ch === '"' || ch === "'") && inputStr[i - 1] !== '\\') inQuote = !inQuote;
        if (!inQuote) {
          if (ch === '[' || ch === '{') depth++;
          if (ch === ']' || ch === '}') depth--;
          if (ch === ',' && depth === 0) {
            tokens.push(buf.trim());
            buf = '';
            continue;
          }
        }
        buf += ch;
      }
      if (buf.trim() !== '') tokens.push(buf.trim());
      return tokens.map(tok => {
        const t = tok.trim();
        if (t === '') return '';
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
          return t.substring(1, t.length - 1);
        if (t.toLowerCase() === 'true') return true;
        if (t.toLowerCase() === 'false') return false;
        if (t.toLowerCase() === 'null') return null;
        if (!isNaN(Number(t))) return Number(t);
        try { return JSON.parse(t); } catch (_) { return t; }
      });
    }
  }
};

const buildAllInputsForTestCases = (testCases) => {
  const all = testCases.map(tc => {
    try { return parseInputStringToArgs(tc.input); }
    catch (e) { return [tc.input]; }
  });
  return JSON.stringify(all);
};

// The Java wrapper (Main.java) — produced as a single template literal to avoid
// fragile JS quoting issues. It's a reflection-based runner that will be compiled once.
const mainJavaContent = `
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class Main {

    static Object parseJsonValue(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.length() == 0) return "";
        if (s.equals("null")) return null;
        if (s.equals("true")) return Boolean.TRUE;
        if (s.equals("false")) return Boolean.FALSE;
        if (s.length() >= 2) {
            int c0 = (int) s.charAt(0);
            int c1 = (int) s.charAt(s.length()-1);
            if ((c0 == 39 && c1 == 39) || (c0 == 34 && c1 == 34)) {
                return unescapeJavaString(s.substring(1, s.length()-1));
            }
        }
        if (s.startsWith("[") && s.endsWith("]")) {
            String inner = s.substring(1, s.length()-1);
            List<Object> list = new ArrayList<>();
            if (inner.trim().length() == 0) return list;
            int depth = 0;
            boolean inQuote = false;
            StringBuilder buf = new StringBuilder();
            for (int i = 0; i < inner.length(); i++) {
                char c = inner.charAt(i);
                if ((int)c == 34 && (i == 0 || inner.charAt(i-1) != (char)92)) inQuote = !inQuote;
                if (!inQuote) {
                    if (c == '[' || c == '{') depth++;
                    if (c == ']' || c == '}') depth--;
                    if (c == ',' && depth == 0) {
                        list.add(parseJsonValue(buf.toString()));
                        buf.setLength(0);
                        continue;
                    }
                }
                buf.append(c);
            }
            if (buf.length() > 0) list.add(parseJsonValue(buf.toString()));
            return list;
        }
        try {
            if (s.indexOf('.') >= 0) return Double.parseDouble(s);
            else {
                try { return Integer.parseInt(s); } catch (NumberFormatException e) { return Long.parseLong(s); }
            }
        } catch (Exception e) {
            if ((s.startsWith("\\"") && s.endsWith("\\"")) || (s.startsWith("\\'") && s.endsWith("\\'"))) return s.substring(1, s.length()-1);
            return s;
        }
    }

    static String unescapeJavaString(String s) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if ((int)ch == 92) {
                if (i+1 >= s.length()) { sb.append(ch); continue; }
                char next = s.charAt(i+1);
                if (next == 'n') { sb.append('\\n'); i++; continue; }
                if (next == 't') { sb.append('\\t'); i++; continue; }
                if (next == 'r') { sb.append('\\r'); i++; continue; }
                if (next == '"') { sb.append('"'); i++; continue; }
                if (next == '\\\\') { sb.append('\\\\'); i++; continue; }
                sb.append(next); i++; continue;
            } else sb.append(ch);
        }
        String tmp = sb.toString();
        tmp = tmp.replace("\\\\n", "\\n").replace("\\\\t", "\\t").replace("\\\\r", "\\r");
        return tmp;
    }

    static Object convertArg(Object parsed, Class<?> paramType) throws Exception {
        if (paramType.isPrimitive()) {
            if (paramType == int.class) {
                if (parsed instanceof Number) return ((Number)parsed).intValue();
                if (parsed instanceof String) return Integer.parseInt((String)parsed);
            } else if (paramType == long.class) {
                if (parsed instanceof Number) return ((Number)parsed).longValue();
                if (parsed instanceof String) return Long.parseLong((String)parsed);
            } else if (paramType == double.class) {
                if (parsed instanceof Number) return ((Number)parsed).doubleValue();
                if (parsed instanceof String) return Double.parseDouble((String)parsed);
            } else if (paramType == boolean.class) {
                if (parsed instanceof Boolean) return parsed;
                if (parsed instanceof String) return Boolean.parseBoolean((String)parsed);
            } else if (paramType == char.class) {
                if (parsed instanceof String && ((String)parsed).length() > 0) return ((String)parsed).charAt(0);
            }
        } else {
            if (Number.class.isAssignableFrom(paramType)) {
                if (parsed instanceof Number) {
                    Number n = (Number) parsed;
                    if (paramType == Integer.class) return n.intValue();
                    if (paramType == Long.class) return n.longValue();
                    if (paramType == Double.class) return n.doubleValue();
                    if (paramType == Float.class) return n.floatValue();
                }
                if (parsed instanceof String) {
                    String str = (String) parsed;
                    if (paramType == Integer.class) return Integer.valueOf(str);
                    if (paramType == Long.class) return Long.valueOf(str);
                    if (paramType == Double.class) return Double.valueOf(str);
                    if (paramType == Float.class) return Float.valueOf(str);
                }
            }
            if (paramType == String.class) {
                if (parsed == null) return null;
                if (parsed instanceof String) return parsed;
                return String.valueOf(parsed);
            }
            if (paramType == Boolean.class) {
                if (parsed instanceof Boolean) return parsed;
                if (parsed instanceof String) return Boolean.valueOf((String)parsed);
            }
            if (paramType.isArray()) {
                Class<?> comp = paramType.getComponentType();
                if (parsed instanceof List) {
                    List<?> lst = (List<?>) parsed;
                    Object arr = Array.newInstance(comp, lst.size());
                    for (int i = 0; i < lst.size(); i++) Array.set(arr, i, convertArg(lst.get(i), comp));
                    return arr;
                }
                Object arr = Array.newInstance(comp, 1);
                Array.set(arr, 0, convertArg(parsed, comp));
                return arr;
            }
            if (List.class.isAssignableFrom(paramType) || Collection.class.isAssignableFrom(paramType)) {
                if (parsed instanceof List) return parsed;
                List<Object> l = new ArrayList<>();
                l.add(parsed);
                return l;
            }
            if (paramType == Object.class) return parsed;
            if (parsed instanceof Number) {
                Number n = (Number) parsed;
                try {
                    Method valueOf = paramType.getMethod("valueOf", String.class);
                    return valueOf.invoke(null, n.toString());
                } catch (Exception ignore) {}
            }
        }
        if (parsed == null) return null;
        if (paramType.isInstance(parsed)) return parsed;
        throw new IllegalArgumentException("Cannot convert " + parsed.getClass().getName() + " to " + paramType.getName());
    }

    static Object invokeSolveReflectively(Object solInstance, List<Object> argsList) throws Exception {
        Method[] methods = solInstance.getClass().getDeclaredMethods();
        List<Method> candidates = new ArrayList<>();
        for (Method m : methods) if (m.getName().equals("solve")) candidates.add(m);

        // exact param count
        for (Method m : candidates) {
            Class<?>[] pts = m.getParameterTypes();
            if (pts.length == argsList.size()) {
                try {
                    Object[] conv = new Object[pts.length];
                    for (int i = 0; i < pts.length; i++) conv[i] = convertArg(argsList.get(i), pts[i]);
                    m.setAccessible(true);
                    return m.invoke(solInstance, conv);
                } catch (Exception e) {}
            }
        }

        // single param receiving all args
        for (Method m : candidates) {
            Class<?>[] pts = m.getParameterTypes();
            if (pts.length == 1) {
                try {
                    Object conv = convertArg(argsList, pts[0]);
                    m.setAccessible(true);
                    return m.invoke(solInstance, conv);
                } catch (Exception e) {}
            }
        }

        // varargs
        for (Method m : candidates) {
            if (m.isVarArgs()) {
                Class<?>[] pts = m.getParameterTypes();
                int fixed = pts.length - 1;
                if (argsList.size() >= fixed) {
                    try {
                        Object[] conv = new Object[pts.length];
                        for (int i = 0; i < fixed; i++) conv[i] = convertArg(argsList.get(i), pts[i]);
                        Class<?> varComp = pts[pts.length - 1].getComponentType();
                        int varlen = argsList.size() - fixed;
                        Object vararr = Array.newInstance(varComp, varlen);
                        for (int i = 0; i < varlen; i++) Array.set(vararr, i, convertArg(argsList.get(fixed + i), varComp));
                        conv[conv.length - 1] = vararr;
                        m.setAccessible(true);
                        return m.invoke(solInstance, conv);
                    } catch (Exception e) {}
                }
            }
        }

        // no-arg
        for (Method m : candidates) {
            if (m.getParameterTypes().length == 0) {
                m.setAccessible(true);
                return m.invoke(solInstance);
            }
        }

        throw new NoSuchMethodException("No suitable solve(...) method found for provided arguments.");
    }

    static String toJsonLike(Object val) {
        if (val == null) return "null";
        if (val instanceof String) return quoteAndEscape((String)val);
        if (val instanceof Boolean) return val.toString();
        if (val instanceof Number) return val.toString();
        if (val.getClass().isArray()) {
            int len = Array.getLength(val);
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            for (int i = 0; i < len; i++) {
                if (i > 0) sb.append(",");
                sb.append(toJsonLike(Array.get(val, i)));
            }
            sb.append("]");
            return sb.toString();
        }
        if (val instanceof Collection) {
            Collection<?> c = (Collection<?>) val;
            StringBuilder sb = new StringBuilder();
            sb.append("[");
            int i = 0;
            for (Object o : c) {
                if (i++ > 0) sb.append(",");
                sb.append(toJsonLike(o));
            }
            sb.append("]");
            return sb.toString();
        }
        if (val instanceof Map) {
            Map<?, ?> m = (Map<?, ?>) val;
            StringBuilder sb = new StringBuilder();
            sb.append("{");
            List<String> keys = new ArrayList<>();
            for (Object k : m.keySet()) keys.add(String.valueOf(k));
            Collections.sort(keys);
            int i = 0;
            for (String k : keys) {
                if (i++ > 0) sb.append(",");
                sb.append(quoteAndEscape(k)).append(":").append(toJsonLike(m.get(k)));
            }
            sb.append("}");
            return sb.toString();
        }
        return quoteAndEscape(val.toString());
    }

    static String quoteAndEscape(String s) {
        StringBuilder sb = new StringBuilder();
        sb.append((char)34);
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == (char)34) { sb.append((char)92); sb.append((char)34); }
            else if (ch == (char)92) { sb.append((char)92); sb.append((char)92); }
            else if (ch == (char)10) { sb.append((char)92); sb.append('n'); }
            else if (ch == (char)13) { sb.append((char)92); sb.append('r'); }
            else if (ch == (char)9) { sb.append((char)92); sb.append('t'); }
            else sb.append(ch);
        }
        sb.append((char)34);
        return sb.toString();
    }

    public static void main(String[] args) {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(System.out);
        try {
            Class<?> solClass = null;
            try { solClass = Class.forName("Solution"); } catch (ClassNotFoundException cnfe) {}
            String line;
            while ((line = br.readLine()) != null) {
                line = line.trim();
                if (line.length() == 0) continue;
                try {
                    Object parsed = parseJsonValue(line);
                    List<Object> argsList;
                    if (parsed instanceof List) argsList = (List<Object>) parsed;
                    else { argsList = new ArrayList<>(); argsList.add(parsed); }
                    if (solClass == null) solClass = Class.forName("Solution");
                    Object solInstance = solClass.getDeclaredConstructor().newInstance();
                    Object result = invokeSolveReflectively(solInstance, argsList);
                    out.println(toJsonLike(result));
                } catch (Throwable e) {
                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    out.println("ERROR:" + sw.toString());
                }
            }
            out.flush();
        } catch (IOException e) {
            e.printStackTrace(System.err);
        }
    }
}
`;

// compile Main once and cache the promise
let mainCompiledPromise = null;
const ensureMainCompiled = async () => {
  if (mainCompiledPromise) return mainCompiledPromise;
  mainCompiledPromise = (async () => {
    await ensureDirs();
    const mainJavaPath = path.join(mainSrcDir, 'Main.java');
    try {
      await fs.writeFile(mainJavaPath, mainJavaContent, 'utf8');
    } catch (err) {
      console.error('Failed to write Main.java:', err);
      throw err;
    }
    // compile (with one retry)
    try {
      let res = await spawnPromise('javac', ['-Xlint:none', '-d', mainBinDir, mainJavaPath], { cwd: mainSrcDir });
      if (res.code !== 0) throw new Error(res.stderr || 'javac failed');
    } catch (err) {
      // retry once briefly
      await new Promise(r => setTimeout(r, 150));
      const res2 = await spawnPromise('javac', ['-Xlint:none', '-d', mainBinDir, mainJavaPath], { cwd: mainSrcDir });
      if (res2.code !== 0) throw new Error(res2.stderr || 'javac failed on retry: ' + (res2.stderr || 'unknown'));
    }
  })();
  return mainCompiledPromise;
};

const writeSolutionFile = async (execDir, userCode) => {
  await fs.mkdir(execDir, { recursive: true });
  // remove package lines and avoid public Solution class
  let code = userCode.replace(/^package\s+[^;]+;?/mg, '');
  code = code.replace(/public\s+class\s+Solution/g, 'class Solution');
  const solPath = path.join(execDir, 'Solution.java');
  await fs.writeFile(solPath, code, 'utf8');
  return solPath;
};

const compileSolutionToDir = (execDir, solPath) => {
  return spawnPromise('javac', ['-Xlint:none', '-d', execDir, solPath], { cwd: execDir }).then(res => {
    if (res.code !== 0) throw new Error(res.stderr || 'javac failed for solution');
    return;
  });
};

const runJavaProcess = (execDir, inputLines, timeout = 20000) => {
  return new Promise((resolve, reject) => {
    const classpath = mainBinDir + path.delimiter + execDir;
    const runner = spawn('java', ['-cp', classpath, 'Main'], { cwd: execDir, timeout });
    let stdout = '', stderr = '';
    if (runner.stdout) runner.stdout.on('data', d => stdout += d.toString());
    if (runner.stderr) runner.stderr.on('data', d => stderr += d.toString());
    runner.on('error', err => reject(err));
    runner.on('close', (code) => resolve({ stdout, stderr, code }));
    try {
      if (Array.isArray(inputLines)) {
        for (const line of inputLines) runner.stdin.write(line + '\n');
      } else {
        runner.stdin.write(inputLines + '\n');
      }
      runner.stdin.end();
    } catch (err) {
      // ignore
    }
  });
};

const cleanupPath = async (fileOrDirPath) => {
  try { await fs.rm(fileOrDirPath, { recursive: true, force: true }); } catch (error) {}
};

const executeJavaAll = async (userCode, testCases) => {
  await ensureMainCompiled();
  const uniqueId = nanoid(8);
  const execDir = path.join(tempDir, uniqueId);
  try {
    const solPath = await writeSolutionFile(execDir, userCode);
    await compileSolutionToDir(execDir, solPath);
    const lines = testCases.map(tc => {
      try { const args = parseInputStringToArgs(tc.input); return JSON.stringify(args); } catch (e) { return JSON.stringify([tc.input]); }
    });
    const { stdout, stderr } = await runJavaProcess(execDir, lines, 20000);
    await cleanupPath(execDir);
    // FIX: The following line was corrected to remove invalid characters
    if (stderr && stderr.trim().length > 0) throw new Error(`Java Runtime Error: ${stderr}`);
    const outputs = stdout.trim().split('\n').filter(Boolean);
    const results = outputs.map(o => o.startsWith('ERROR:') ? { success: false, error: o.substring(6) } : { success: true, output: o });
    while (results.length < testCases.length) results.push({ success: false, error: 'No output' });
    return results;
  } catch (err) {
    await cleanupPath(execDir).catch(()=>{});
    throw err;
  }
};

const executeJava = async (userCode, input, allTestCases) => {
  await ensureMainCompiled();
  const uniqueId = nanoid(8);
  const execDir = path.join(tempDir, uniqueId);
  try {
    const solPath = await writeSolutionFile(execDir, userCode);
    await compileSolutionToDir(execDir, solPath);
    const argsArr = parseInputStringToArgs(input || "");
    const line = JSON.stringify(argsArr);
    const { stdout, stderr } = await runJavaProcess(execDir, [line], 5000);
    await cleanupPath(execDir);
    if (stderr && stderr.trim().length > 0) throw new Error(`Java Runtime Error: ${stderr}`);
    const outTrim = stdout.trim();
    if (outTrim.startsWith('ERROR:')) throw new Error(outTrim.substring(6));
    return { type: 'success', output: outTrim };
  } catch (err) {
    await cleanupPath(execDir).catch(()=>{});
    return { type: 'error', message: err.message || String(err) };
  }
};

/* ---------- JS & Python runners (unchanged robust implementations) ---------- */

// JS batch runner
const executeAllTestCasesJS = (code, testCases) => {
  return new Promise(async (resolve, reject) => {
    const uniqueId = nanoid(8);
    const tempFileName = `script-${uniqueId}.js`;
    const tempFilePath = path.join(tempDir, tempFileName);
    const allInputs = buildAllInputsForTestCases(testCases);
    const BATCH_TIMEOUT = 20000;

    const wrappedCode = `
${code}

(async () => {
  try {
    if (typeof solve !== 'function') throw new Error("A 'solve' function was not found.");
    const allTestInputs = JSON.parse(process.argv[2]);
    const results = [];
    for (const args of allTestInputs) {
      try {
        const res = Array.isArray(args) ? await solve(...args) : await solve(args);
        results.push({ success: true, output: JSON.stringify(res === undefined ? null : res) });
      } catch (e) {
        results.push({ success: false, error: (e && e.stack) ? (e.name + ': ' + e.message + '\\n' + e.stack) : (e ? e.toString() : 'Unknown error') });
      }
    }
    console.log(JSON.stringify(results));
  } catch (err) {
    console.error("Execution Engine Error: " + (err && err.stack ? err.stack : err));
    process.exit(1);
  }
})();
    `;

    try {
      await fs.writeFile(tempFilePath, wrappedCode);
      const child = spawn('node', [tempFilePath, allInputs], { timeout: BATCH_TIMEOUT });
      handleBatchChild(child, tempFilePath, resolve, reject);
    } catch (err) { reject(err); }
  });
};

// JS single-run
const executeJavaScript = (code, input) => {
  return new Promise(async (resolve, reject) => {
    const uniqueId = nanoid(8);
    const tempFilePath = path.join(tempDir, `script-${uniqueId}.js`);
    const args = parseInputStringToArgs(input || "");
    const argsJson = JSON.stringify([args]);
    const wrappedCode = `
${code}
(async () => {
  try {
    if (typeof solve !== 'function') throw new Error("A 'solve' function was not found.");
    const allTestInputs = JSON.parse(process.argv[2]);
    const args = allTestInputs[0];
    const res = Array.isArray(args) ? await solve(...args) : await solve(args);
    console.log(JSON.stringify(res === undefined ? null : res));
  } catch (e) {
    console.error(e.name + ": " + e.message);
    process.exit(1);
  }
})();
    `;
    try {
      await fs.writeFile(tempFilePath, wrappedCode);
      const child = spawn('node', [tempFilePath, argsJson], { timeout: 5000 });
      handleSingleChild(child, tempFilePath, resolve, reject);
    } catch (err) { reject({ type: 'error', message: err.message }); }
  });
};

// Python batch
const executePythonAll = (code, testCases) => {
  return new Promise(async (resolve, reject) => {
    const uniqueId = nanoid(8);
    const tempFileName = `script-${uniqueId}.py`;
    const tempFilePath = path.join(tempDir, tempFileName);
    const allInputs = buildAllInputsForTestCases(testCases);
    const BATCH_TIMEOUT = 20000;

    const wrappedCode = `
import sys, json, traceback, asyncio

${code}

def run_sync(func, args):
    return func(*args) if isinstance(args, list) else func(args)

async def run_all():
    try:
        if 'solve' not in globals():
            raise NameError("A 'solve' function was not found.")
        all_inputs = json.loads(sys.argv[1])
        results = []
        for args in all_inputs:
            try:
                if asyncio.iscoroutinefunction(solve):
                    res = await solve(*args) if isinstance(args, list) else await solve(args)
                else:
                    res = run_sync(solve, args if isinstance(args, list) else [args])
                results.append({ "success": True, "output": json.dumps(None if res is None else res) })
            except Exception as e:
                results.append({ "success": False, "error": str(e) + "\\n" + traceback.format_exc() })
        print(json.dumps(results))
    except Exception as e:
        print("Execution Engine Error: " + str(e), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_all())
    `;

    try {
      await fs.writeFile(tempFilePath, wrappedCode);
      const child = spawn('python3', [tempFilePath, allInputs], { timeout: BATCH_TIMEOUT });
      handleBatchChild(child, tempFilePath, resolve, reject);
    } catch (err) { reject(err); }
  });
};

// Python single-run
const executePython = (code, input) => {
  return new Promise(async (resolve, reject) => {
    const uniqueId = nanoid(8);
    const tempFilePath = path.join(tempDir, `script-${uniqueId}.py`);
    const args = parseInputStringToArgs(input || "");
    const argsJson = JSON.stringify([args]);
    const wrappedCode = `
import sys, json, traceback
${code}
def main():
    try:
        if 'solve' not in globals():
            raise NameError("A 'solve' function was not found.")
        all_inputs = json.loads(sys.argv[1])
        args = all_inputs[0]
        res = solve(*args) if isinstance(args, list) else solve(args)
        print(json.dumps(None if res is None else res))
    except Exception as e:
        print(str(e) + "\\n" + traceback.format_exc(), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
    `;
    try {
      await fs.writeFile(tempFilePath, wrappedCode);
      const child = spawn('python3', [tempFilePath, argsJson], { timeout: 5000 });
      handleSingleChild(child, tempFilePath, resolve, reject);
    } catch (err) { reject({ type: 'error', message: err.message }); }
  });
};

const handleBatchChild = (child, tempFilePath, resolve, reject) => {
  let stdout = '', stderr = '';
  if (child.stdout) child.stdout.on('data', d => stdout += d.toString());
  if (child.stderr) child.stderr.on('data', d => stderr += d.toString());
  child.on('close', async () => {
    await cleanupPath(tempFilePath);
    if (stderr && stderr.trim().length > 0) return reject(new Error(stderr.trim()));
    try { const parsed = JSON.parse(stdout.trim()); resolve(parsed); }
    catch (e) { reject(new Error('Failed to parse execution results: ' + stdout)); }
  });
  child.on('error', async (err) => { await cleanupPath(tempFilePath); reject(err); });
};

const handleSingleChild = (child, tempFilePath, resolve, reject) => {
  let stdout = '', stderr = '';
  if (child.stdout) child.stdout.on('data', d => stdout += d.toString());
  if (child.stderr) child.stderr.on('data', d => stderr += d.toString());
  child.on('close', async () => {
    await cleanupPath(tempFilePath);
    if (stderr && stderr.trim().length > 0) return reject({ type: 'error', message: stderr.trim() });
    try {
      const outTrim = stdout.trim();
      try { const parsed = JSON.parse(outTrim); resolve({ type: 'success', output: parsed }); }
      catch (e) { resolve({ type: 'success', output: outTrim }); }
    } catch (e) { reject({ type: 'error', message: e.message }); }
  });
  child.on('error', async (err) => { await cleanupPath(tempFilePath); reject({ type: 'error', message: err.message }); });
};

// Public API
const executeAllTestCases = (language, code, testCases) => {
  switch (language) {
    case 'javascript': return executeAllTestCasesJS(code, testCases);
    case 'python': return executePythonAll(code, testCases);
    case 'java': return executeJavaAll(code, testCases);
    default: return Promise.reject(new Error(`Language ${language} not supported for batch execution.`));
  }
};

const executeCode = (language, code, input, problemTitle, allTestCases) => {
  switch (language) {
    case 'javascript': return executeJavaScript(code, input);
    case 'python': return executePython(code, input);
    case 'java': return executeJava(code, input, allTestCases);
    default: return Promise.reject({ type: 'error', message: `Language ${language} not supported.` });
  }
};

export { executeCode, executeAllTestCases };