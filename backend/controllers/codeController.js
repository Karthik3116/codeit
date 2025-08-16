

// controllers/codeController.js
import Contest from "../models/contestModel.js";
import { executeCode, executeAllTestCases } from "../utils/sandbox.js";

/**
 * canonicalize: turn a value or a possibly-string representation into a stable serialized form.
 * - tries JSON.parse, if succeeds then serializes with stable key order (for objects).
 * - leaves arrays as-is (order preserved).
 * - returns a string that can be compared reliably across languages.
 */
const canonicalize = (val) => {
    const stableStringify = (v) => {
        if (v === null) return 'null';
        if (Array.isArray(v)) {
            return '[' + v.map(stableStringify).join(',') + ']';
        }
        if (typeof v === 'object') {
            const keys = Object.keys(v).sort();
            return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
        }
        // primitives: ensure numbers are normalized
        if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
        return JSON.stringify(v);
    };

    if (typeof val === 'string') {
        // try parse JSON from string (handles '"abc"', '[1,2]', '3', 'true', '{"a":1}')
        try {
            const parsed = JSON.parse(val);
            return stableStringify(parsed);
        } catch (e) {
            // not JSON parsable -> treat as trimmed string
            return JSON.stringify(val.trim());
        }
    }
    return stableStringify(val);
};

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

            let passedCount = 0;
            let executionResults;

            try {
                executionResults = await executeAllTestCases(language, code, problem.testCases);
            } catch (err) {
                console.error("Batch execution failed:", err);
                return res.status(200).json({ success: false, testCasesPassed: 0, totalTestCases, score: 0, error: err.message });
            }

            // compare outputs using canonicalize
            for (let i = 0; i < totalTestCases; i++) {
                const testCase = problem.testCases[i];
                const runRes = executionResults[i];
                if (runRes && runRes.success) {
                    const actualCanonical = canonicalize(runRes.output);
                    const expectedCanonical = canonicalize(testCase.output);
                    if (actualCanonical === expectedCanonical) {
                        passedCount++;
                    }
                }
            }
            
            const currentProblemScore = (totalTestCases > 0) ? Math.floor((passedCount / totalTestCases) * 100) : 0;
            const userInLeaderboard = contest.leaderboard.find(p => p.userId.equals(req.user._id));

            if (userInLeaderboard) {
                const oldTotalScore = userInLeaderboard.score;
                let problemScoreEntry = userInLeaderboard.problemScores.find(ps => ps.problemId.equals(problemId));
                
                if (problemScoreEntry) {
                    // Only update score if the new score is an improvement
                    if (currentProblemScore > problemScoreEntry.score) {
                         problemScoreEntry.score = currentProblemScore;
                    }
                } else {
                    userInLeaderboard.problemScores.push({ problemId, score: currentProblemScore });
                }
                
                // recompute total as sum of per-problem scores
                userInLeaderboard.score = userInLeaderboard.problemScores.reduce((total, ps) => total + (ps.score || 0), 0);

                if (userInLeaderboard.score > oldTotalScore) {
                    userInLeaderboard.lastSuccessfulSubmissionTime = new Date();
                } else if (userInLeaderboard.score > 0 && !userInLeaderboard.lastSuccessfulSubmissionTime) {
                    userInLeaderboard.lastSuccessfulSubmissionTime = new Date();
                }
                
                contest.markModified('leaderboard');
                await contest.save();
                
                const sortedLeaderboard = contest.leaderboard.sort((a, b) => {
                    if (a.score !== b.score) return b.score - a.score;
                    // earlier lastSuccessfulSubmissionTime wins
                    if (!a.lastSuccessfulSubmissionTime && !b.lastSuccessfulSubmissionTime) return 0;
                    if (!a.lastSuccessfulSubmissionTime) return 1;
                    if (!b.lastSuccessfulSubmissionTime) return -1;
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
