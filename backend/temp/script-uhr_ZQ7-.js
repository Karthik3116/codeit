try { function solve(arg1) {
  // If arg1 is a number, it doubles it… but only if it’s even, otherwise it turns it into a cat 😼
  if (typeof arg1 === "number") {
    return arg1 % 2 === 0 ? arg1 * 2 : "🐱";
  }
  
  // If arg1 is a string, reverse it and make it shout
  if (typeof arg1 === "string") {
    return arg1.split("").reverse().join("").toUpperCase();
  }

  // For anything else, just give them a cookie 🍪
  return "🍪";
} if (typeof solve !== 'function') { throw new Error("A 'solve' function was not found."); } const funcInput = JSON.parse(process.argv[2]); const result = Array.isArray(funcInput) ? solve(...funcInput) : solve(funcInput); const output = typeof result === 'string' ? JSON.stringify(result) : JSON.stringify(result); console.log(output); } catch (e) { console.error(e.name + ": " + e.message); }