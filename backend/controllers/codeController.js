
import Contest from "../models/contestModel.js";
import { executeCode, executeAllTestCases } from "../utils/sandbox.js";

/**
 * canonicalize: turn a value or a possibly-string representation into a stable serialized form.
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
        if (typeof v === 'number' && !Number.isFinite(v)) return String(v);
        return JSON.stringify(v);
    };

    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return stableStringify(parsed);
        } catch (e) {
            return JSON.stringify(val.trim());
        }
    }
    return stableStringify(val);
};

/**
 * Helper: Safely get ObjectId string for comparison (works if passed ObjectId or string)
 */
const idToString = (id) => {
    if (!id && id !== 0) return '';
    if (typeof id === 'string') return id;
    if (typeof id.toString === 'function') return id.toString();
    return String(id);
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
        
        const result = await executeCode(language, code, input || "");
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

            let executionResults;
            try {
                executionResults = await executeAllTestCases(language, code, problem.testCases);
            } catch (err) {
                console.error("Batch execution failed:", err);
                return res.status(200).json({ success: false, testCasesPassed: 0, totalTestCases, score: 0, error: err.message });
            }

            let passedCount = 0;
            for (let i = 0; i < totalTestCases; i++) {
                const testCase = problem.testCases[i];
                const runRes = executionResults[i];
                if (runRes && runRes.success) {
                    if (canonicalize(runRes.output) === canonicalize(testCase.output)) {
                        passedCount++;
                    }
                }
            }
            
            const currentProblemScore = (totalTestCases > 0) ? Math.floor((passedCount / totalTestCases) * 100) : 0;
            
            // --- START: Robust leaderboard update (handles add or update) ---
            // Ensure leaderboard exists
            if (!Array.isArray(contest.leaderboard)) contest.leaderboard = [];

            const userIdStr = idToString(req.user._id);
            let userIndex = contest.leaderboard.findIndex(p => idToString(p.userId) === userIdStr);

            if (userIndex === -1) {
                // create new entry if not found
                const newEntry = {
                    userId: req.user._id,
                    score: currentProblemScore,
                    problemScores: [{ problemId: problemId, score: currentProblemScore }],
                    lastSuccessfulSubmissionTime: currentProblemScore > 0 ? new Date() : null
                };
                contest.leaderboard.push(newEntry);
                // mark modified and save
                contest.markModified('leaderboard');
                await contest.save();
                userIndex = contest.leaderboard.findIndex(p => idToString(p.userId) === userIdStr);
            } else {
                // update existing entry
                // operate on a plain object to ensure changes are applied
                const existing = contest.leaderboard[userIndex].toObject ? contest.leaderboard[userIndex].toObject() : { ...contest.leaderboard[userIndex] };

                const oldTotalScore = Number(existing.score || 0);
                if (!Array.isArray(existing.problemScores)) existing.problemScores = [];

                const psIndex = existing.problemScores.findIndex(ps => idToString(ps.problemId) === idToString(problemId));
                let previousProblemScore = -1;
                if (psIndex > -1) {
                    previousProblemScore = Number(existing.problemScores[psIndex].score || 0);
                    if (currentProblemScore > previousProblemScore) {
                        existing.problemScores[psIndex].score = currentProblemScore;
                    } // else do not downgrade
                } else {
                    existing.problemScores.push({ problemId: problemId, score: currentProblemScore });
                }

                // Recalculate total
                const newTotalScore = existing.problemScores.reduce((acc, ps) => acc + (Number(ps.score) || 0), 0);
                existing.score = newTotalScore;

                // Update timestamp if improved for this problem or total increased
                if ( (previousProblemScore < currentProblemScore) || (newTotalScore > oldTotalScore) ) {
                    existing.lastSuccessfulSubmissionTime = new Date();
                }

                // Replace entry in array with updated plain object
                contest.leaderboard[userIndex] = existing;
                contest.markModified('leaderboard');
                await contest.save();
            }

            // After save, fetch sorted leaderboard to emit
            // Re-fetch contest to ensure we have the most recent doc (optional but safer)
            const freshContest = await Contest.findById(contestId);
            if (freshContest) {
                const sortedLeaderboard = (freshContest.leaderboard || []).slice().sort((a, b) => {
                    const ascore = Number(a.score || 0), bscore = Number(b.score || 0);
                    if (ascore !== bscore) return bscore - ascore;
                    const at = a.lastSuccessfulSubmissionTime ? new Date(a.lastSuccessfulSubmissionTime).getTime() : 0;
                    const bt = b.lastSuccessfulSubmissionTime ? new Date(b.lastSuccessfulSubmissionTime).getTime() : 0;
                    // earlier submission wins when scores equal: smaller timestamp -> earlier -> put earlier above?
                    // Your previous comparator placed earlier (?) Let's keep earlier time ahead:
                    return at - bt;
                });
                // Emit sorted leaderboard
                try {
                    req.io.to(freshContest.roomId).emit('leaderboard:update', sortedLeaderboard);
                } catch (emitErr) {
                    console.warn('Failed to emit leaderboard:update', emitErr);
                }
            }
            // --- END: leaderboard update ---

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
                // small backoff before retry
                await new Promise(r => setTimeout(r, 50 * attempt));
            } else {
                console.error("Error during submission:", error);
                return res.status(500).json({ message: 'Server error during submission', error: error.message });
            }
        }
    }
};
