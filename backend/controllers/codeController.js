
// controllers/codeController.js
import Contest from "../models/contestModel.js";
import { executeCode, executeAllTestCases } from "../utils/sandbox.js";

/**
 * Handles the "Run Code" button functionality for a single, custom input.
 */
export const runCode = async (req, res) => {
    const { language, code, input, problemId, contestId } = req.body;
    if (!code || !language || !problemId || !contestId) {
        return res.status(400).json({ message: "Missing required fields." });
    }
    try {
        const contest = await Contest.findById(contestId);
        if (!contest) return res.status(404).json({ message: "Contest not found" });
        const problem = contest.questions.id(problemId);
        if (!problem) return res.status(404).json({ message: "Problem not found in this contest" });
        
        const result = await executeCode(language, code, input || "", problem.title, problem.testCases);
        res.json(result);
    } catch (error) {
        res.status(200).json({ type: "error", message: error.message || "An error occurred during execution." });
    }
};

/**
 * Handles the "Submit Code" functionality, running against all hidden test cases.
 */
export const submitCode = async (req, res) => {
    const { language, code, problemId, contestId } = req.body;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const contest = await Contest.findById(contestId);
            if (!contest) return res.status(404).json({ message: 'Contest not found' });
            
            const problem = contest.questions.id(problemId);
            if (!problem) return res.status(404).json({ message: 'Problem not found in this contest' });
            if (new Date() > new Date(contest.endTime)) return res.status(400).json({ message: 'Contest has already ended.' });

            const totalTestCases = problem.testCases.length;
            if (totalTestCases === 0) {
                 return res.json({ success: true, testCasesPassed: 0, totalTestCases: 0, score: 100 });
            }

            const normalize = (str) => {
                if (typeof str !== 'string') str = String(str ?? '');
                try {
                    let parsed = JSON.parse(str);
                    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'number')) {
                        parsed = parsed.slice().sort((a,b) => a - b);
                    }
                    return JSON.stringify(parsed);
                } catch (e) {
                    return str.trim().replace(/\r\n/g, '\n');
                }
            };

            let passedCount = 0;
            let executionResults;

            try {
                // All languages use the efficient batch executor
                executionResults = await executeAllTestCases(language, code, problem.testCases);
            } catch (err) {
                // This catches catastrophic errors like compilation failures
                console.error("Batch execution failed:", err);
                return res.status(200).json({ success: false, testCasesPassed: 0, totalTestCases, score: 0, error: err.message });
            }

            for (let i = 0; i < totalTestCases; i++) {
                const testCase = problem.testCases[i];
                const runRes = executionResults[i];
                if (runRes && runRes.success && normalize(runRes.output) === normalize(testCase.output)) {
                    passedCount++;
                }
            }
            
            const currentProblemScore = (totalTestCases > 0) ? Math.floor((passedCount / totalTestCases) * 100) : 0;
            const userInLeaderboard = contest.leaderboard.find(p => p.userId.equals(req.user._id));

            if (userInLeaderboard) {
                const oldTotalScore = userInLeaderboard.score;
                let problemScoreEntry = userInLeaderboard.problemScores.find(ps => ps.problemId.equals(problemId));
                
                if (problemScoreEntry) {
                    // *** FIX: Only update score if the new score is an improvement ***
                    if (currentProblemScore > problemScoreEntry.score) {
                         problemScoreEntry.score = currentProblemScore;
                    }
                } else {
                    userInLeaderboard.problemScores.push({ problemId, score: currentProblemScore });
                }
                
                userInLeaderboard.score = userInLeaderboard.problemScores.reduce((total, ps) => total + ps.score, 0);

                if (userInLeaderboard.score > oldTotalScore) {
                    userInLeaderboard.lastSuccessfulSubmissionTime = new Date();
                } else if (userInLeaderboard.score > 0 && !userInLeaderboard.lastSuccessfulSubmissionTime) {
                    userInLeaderboard.lastSuccessfulSubmissionTime = new Date();
                }
                
                contest.markModified('leaderboard');
                await contest.save();
                
                const sortedLeaderboard = contest.leaderboard.sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;
                    if (a.lastSuccessfulSubmissionTime === null) return 1;
                    if (b.lastSuccessfulSubmissionTime === null) return -1;
                    return a.lastSuccessfulSubmissionTime - b.lastSuccessfulSubmissionTime;
                });
                req.io.to(contest.roomId).emit('leaderboard:update', sortedLeaderboard);
            }

            return res.json({
                success: passedCount === totalTestCases,
                testCasesPassed: passedCount,
                totalTestCases: totalTestCases,
                score: currentProblemScore
            });

        } catch (error) {
            if (error.name === 'VersionError') {
                console.log(`Version conflict for contest ${contestId}, attempt ${attempt}. Retrying...`);
                if (attempt === MAX_RETRIES) {
                    return res.status(409).json({ message: "High traffic. Please try submitting again." });
                }
            } else {
                console.error("Error during submission:", error);
                return res.status(500).json({ message: 'Server error during submission', error: error.message });
            }
        }
    }
};