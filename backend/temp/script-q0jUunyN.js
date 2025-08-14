try { function solve(nums) {
    const n = nums.length;
    const expectedSum = (n * (n + 1)) / 2; // sum from 0 to n
    const actualSum = nums.reduce((acc, num) => acc + num, 0);
    return expectedSum - actualSum;
} if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); } const funcInput = JSON.parse(process.argv[2]); const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput); const output = typeof result === 'string' ? JSON.stringify(result) : JSON.stringify(result); console.log(output); } catch (e) { console.error(e.name + ": " + e.message); }