import Contest from "../models/contestModel.js";
import { executeCode } from "../utils/sandbox.js";

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

        // FIX: Pass problem.testCases as the 5th argument for the dynamic Java runner
        const result = await executeCode(language, code, input || "", problem.title, problem.testCases);
        res.json(result);
    } catch (error) {
        res.status(200).json({ type: "error", message: error.message || "An error occurred during execution." });
    }
};

export const submitCode = async (req, res) => {
    const { language, code, problemId, contestId } = req.body;
    try {
        const contest = await Contest.findById(contestId);
        if (!contest) return res.status(404).json({ message: 'Contest not found' });
        
        const problem = contest.questions.id(problemId);
        if (!problem) return res.status(404).json({ message: 'Problem not found in this contest' });

        if (new Date() > new Date(contest.endTime)) {
            return res.status(400).json({ message: 'Contest has already ended.' });
        }
        
        let passedCount = 0;
        const totalTestCases = problem.testCases.length;
        
        const normalize = (str) => {
            try {
                let parsed = JSON.parse(str);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'number')) {
                    parsed.sort((a, b) => a - b);
                }
                return JSON.stringify(parsed);
            } catch (e) {
                return str.toString().trim().replace(/\r\n/g, '\n');
            }
        };

        for (const testCase of problem.testCases) {
            try {
                // FIX: Pass problem.testCases as the 5th argument for the dynamic Java runner
                const executionResult = await executeCode(language, code, testCase.input, problem.title, problem.testCases);
                if (normalize(executionResult.output) === normalize(testCase.output)) {
                    passedCount++;
                }
            } catch (error) {
                continue;
            }
        }
        
        const currentProblemScore = (totalTestCases > 0) ? Math.floor((passedCount / totalTestCases) * 100) : 0;
        const userInLeaderboard = contest.leaderboard.find(p => p.userId.equals(req.user._id));

        if (userInLeaderboard) {
            let problemScoreEntry = userInLeaderboard.problemScores.find(ps => ps.problemId.equals(problemId));
            if (problemScoreEntry) {
                if (currentProblemScore > problemScoreEntry.score) {
                    problemScoreEntry.score = currentProblemScore;
                }
            } else {
                userInLeaderboard.problemScores.push({ problemId, score: currentProblemScore });
            }
            userInLeaderboard.score = userInLeaderboard.problemScores.reduce((total, ps) => total + ps.score, 0);
            
            await contest.save();
            const sortedLeaderboard = contest.leaderboard.sort((a,b) => b.score - a.score);
            req.io.to(contest.roomId).emit('leaderboard:update', sortedLeaderboard);
        }
        
        res.json({ 
            success: passedCount === totalTestCases,
            testCasesPassed: passedCount,
            totalTestCases: totalTestCases,
            score: currentProblemScore
        });

    } catch (error) {
        console.error("Error during submission:", error);
        res.status(500).json({ message: 'Server error during submission', error: error.message });
    }
};