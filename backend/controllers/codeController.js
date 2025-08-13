import { executeCode } from "../utils/sandbox.js";
import Problem from "../models/problemModel.js";
import Contest from "../models/contestModel.js";

// @desc    Run code against a single test case
// @route   POST /api/code/run
// @access  Private
export const runCode = async (req, res) => {
    const { language, code, input, problemId } = req.body; // problemId is needed for context
    if (!code) {
        return res.status(400).json({ message: "Code cannot be empty." });
    }
     if (!language) {
        return res.status(400).json({ message: "Language must be specified." });
    }
    
    try {
        const problem = await Problem.findById(problemId);
        if (!problem) return res.status(404).json({ message: "Problem not found" });

        const result = await executeCode(language, code, input || "", problem.title);
        res.json(result);
    } catch (error) {
        res.status(200).json({ type: "error", message: error.message || "An error occurred during execution." });
    }
};

// @desc    Submit code for scoring against all test cases
// @route   POST /api/code/submit
// @access  Private
// export const submitCode = async (req, res) => {
//     const { language, code, problemId, contestId } = req.body;
//     try {
//         const contest = await Contest.findById(contestId);
//         const problem = await Problem.findById(problemId);

//         if (!contest || !problem) {
//             return res.status(404).json({ message: 'Contest or Problem not found' });
//         }

//         if (new Date() > new Date(contest.endTime)) {
//             return res.status(400).json({ message: 'Contest has already ended.' });
//         }
        
//         let allTestsPassed = true;
//         const results = [];
        
//         for (const testCase of problem.testCases) {
//             try {
//                 const executionResult = await executeCode(language, code, testCase.input);
                
//                 // Normalize JSON output for comparison
//                 const normalize = (str) => {
//                     try {
//                         // Sort keys for objects to handle different key orders
//                         let parsed = JSON.parse(str);
//                         if (Array.isArray(parsed)) {
//                            parsed.sort();
//                         }
//                         return JSON.stringify(parsed);
//                     } catch {
//                         return str;
//                     }
//                 }
//                 const isCorrect = normalize(executionResult.output) === normalize(testCase.output);
                
//                 results.push({
//                     testCaseId: testCase._id,
//                     success: isCorrect,
//                     output: executionResult.output,
//                     expected: testCase.output
//                 });
                
//                 if (!isCorrect) {
//                     allTestsPassed = false;
//                 }

//             } catch (error) {
//                 allTestsPassed = false;
//                 results.push({
//                     testCaseId: testCase._id,
//                     success: false,
//                     error: error.message
//                 });
//             }
//         }
        
//         if (allTestsPassed) {
//             const userInLeaderboard = contest.leaderboard.find(p => p.userId.equals(req.user._id));
//             if (userInLeaderboard) {
//                 const alreadySolved = userInLeaderboard.solvedProblems.some(id => id.equals(problemId));
//                 if (!alreadySolved) {
//                     userInLeaderboard.score += 100; // Award 100 points for a correct solution
//                     userInLeaderboard.solvedProblems.push(problemId);
//                     await contest.save();
                    
//                     const sortedLeaderboard = contest.leaderboard.sort((a,b) => b.score - a.score);
//                     req.io.to(contest.roomId).emit('leaderboard:update', sortedLeaderboard);
//                 }
//             }
//         }
        
//         res.json({ success: allTestsPassed, results });

//     } catch (error) {
//         res.status(500).json({ message: 'Server error during submission', error: error.message });
//     }
// };

export const submitCode = async (req, res) => {
    const { language, code, problemId, contestId } = req.body;
    try {
        const contest = await Contest.findById(contestId);
        const problem = await Problem.findById(problemId);

        if (!contest || !problem) {
            return res.status(404).json({ message: 'Contest or Problem not found' });
        }

        if (new Date() > new Date(contest.endTime)) {
            return res.status(400).json({ message: 'Contest has already ended.' });
        }
        
        let allTestsPassed = true;
        const results = [];
        
        for (const testCase of problem.testCases) {
            try {
                const executionResult = await executeCode(language, code, testCase.input, problem.title);
                
                const normalize = (str) => {
                    try {
                        let parsed = JSON.parse(str);
                        if (Array.isArray(parsed)) {
                           // For arrays of numbers, sort them to handle different orders.
                           if (parsed.every(item => typeof item === 'number')) {
                               parsed.sort((a, b) => a - b);
                           }
                        }
                        return JSON.stringify(parsed);
                    } catch {
                        return str;
                    }
                }
                const isCorrect = normalize(executionResult.output) === normalize(testCase.output);
                
                results.push({
                    testCaseId: testCase._id,
                    success: isCorrect,
                    output: executionResult.output,
                    expected: testCase.output
                });
                
                if (!isCorrect) {
                    allTestsPassed = false;
                }

            } catch (error) {
                allTestsPassed = false;
                results.push({
                    testCaseId: testCase._id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        if (allTestsPassed) {
            const userInLeaderboard = contest.leaderboard.find(p => p.userId.equals(req.user._id));
            if (userInLeaderboard) {
                const alreadySolved = userInLeaderboard.solvedProblems.some(id => id.equals(problemId));
                if (!alreadySolved) {
                    userInLeaderboard.score += 100;
                    userInLeaderboard.solvedProblems.push(problemId);
                    await contest.save();
                    
                    const sortedLeaderboard = contest.leaderboard.sort((a,b) => b.score - a.score);
                    req.io.to(contest.roomId).emit('leaderboard:update', sortedLeaderboard);
                }
            }
        }
        
        res.json({ success: allTestsPassed, results });

    } catch (error) {
        res.status(500).json({ message: 'Server error during submission', error: error.message });
    }
};
