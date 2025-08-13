
// backend/controllers/contestController.js
import Contest from "../models/contestModel.js";
import Problem from "../models/problemModel.js";
import { nanoid } from "nanoid";
import { executeCode } from "../utils/sandbox.js";

/**
 * Run code (single run, used by "Run" button in editor)
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

    // Pass problem.testCases as the 5th argument for the dynamic Java runner
    const result = await executeCode(language, code, input || "", problem.title, problem.testCases);
    return res.json(result);
  } catch (error) {
    return res.status(200).json({ type: "error", message: error.message || "An error occurred during execution." });
  }
};

/**
 * Submit code (evaluate against all test cases, update leaderboard)
 */
export const submitCode = async (req, res) => {
  const { language, code, problemId, contestId } = req.body;
  try {
    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ message: "Contest not found" });

    const problem = contest.questions.id(problemId);
    if (!problem) return res.status(404).json({ message: "Problem not found in this contest" });

    if (new Date() > new Date(contest.endTime)) {
      return res.status(400).json({ message: "Contest has already ended." });
    }

    let passedCount = 0;
    const totalTestCases = problem.testCases.length;

    // normalize: try to JSON.parse the string; if succeeds, return canonical JSON.stringify(parsed)
    // otherwise fallback to trimmed raw string (and strip surrounding quotes if present)
    const normalize = (str) => {
      if (str === null || str === undefined) return "null";
      const s = str.toString().trim();
      if (s === "") return "";

      try {
        const parsed = JSON.parse(s);
        return JSON.stringify(parsed);
      } catch (e) {
        const raw = s.replace(/\r\n/g, "\n").trim();
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
          return raw.substring(1, raw.length - 1);
        }
        return raw;
      }
    };

    // Evaluate testcases sequentially (stable deterministic order)
    for (const testCase of problem.testCases) {
      try {
        // Execute with the testCase.input (the sandbox JSON-stringifies arguments internally)
        const executionResult = await executeCode(language, code, testCase.input, problem.title, problem.testCases);

        if (!executionResult || executionResult.type !== "success") {
          continue;
        }

        const actual = normalize(executionResult.output);
        const expected = normalize(testCase.output);

        if (actual === expected) {
          passedCount++;
        } else {
          // optional debug:
          // console.debug("Mismatch:", { input: testCase.input, expected, actual });
        }
      } catch (error) {
        continue;
      }
    }

    const currentProblemScore = totalTestCases > 0 ? Math.floor((passedCount / totalTestCases) * 100) : 0;
    const userInLeaderboard = contest.leaderboard.find((p) => p.userId.equals(req.user._id));

    if (userInLeaderboard) {
      let problemScoreEntry = userInLeaderboard.problemScores.find((ps) => ps.problemId.equals(problemId));
      if (problemScoreEntry) {
        if (currentProblemScore > problemScoreEntry.score) {
          problemScoreEntry.score = currentProblemScore;
        }
      } else {
        userInLeaderboard.problemScores.push({ problemId, score: currentProblemScore });
      }
      userInLeaderboard.score = userInLeaderboard.problemScores.reduce((total, ps) => total + ps.score, 0);

      await contest.save();
      const sortedLeaderboard = contest.leaderboard.sort((a, b) => b.score - a.score);
      req.io.to(contest.roomId).emit("leaderboard:update", sortedLeaderboard);
    }

    return res.json({
      success: passedCount === totalTestCases,
      testCasesPassed: passedCount,
      totalTestCases: totalTestCases,
      score: currentProblemScore,
    });
  } catch (error) {
    console.error("Error during submission:", error);
    return res.status(500).json({ message: "Server error during submission", error: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*  Contest management endpoints (create/join/lobby/start/questions/leaderboard)*/
/* -------------------------------------------------------------------------- */

/**
 * Create a new contest
 */
export const createContest = async (req, res) => {
    const { duration, questions } = req.body;
    if (!duration || duration < 10) {
        return res.status(400).json({ message: "Contest duration must be at least 10 minutes." });
    }
    if (!questions || questions.length === 0) {
        return res.status(400).json({ message: "A contest must have at least one question." });
    }
    
    try {
        const newContest = new Contest({
            roomId: nanoid(8),
            createdBy: req.user._id,
            duration,
            status: 'waiting',
            questions: questions,
            participants: [{ userId: req.user._id, userName: req.user.name }],
            leaderboard: [{ userId: req.user._id, userName: req.user.name, score: 0, problemScores: [] }]
        });
        
        const createdContest = await newContest.save();
        res.status(201).json(createdContest);
    } catch (error) {
        console.error("Error creating contest:", error);
        res.status(500).json({ message: "Server error while creating contest." });
    }
};

/**
 * Join an existing contest by roomId
 */
export const joinContest = async (req, res) => {
    const { roomId } = req.body;
    try {
        let contest = await Contest.findOne({ roomId });
        if (!contest) return res.status(404).json({ message: "Contest not found." });
        if (contest.status !== 'waiting') return res.status(400).json({ message: "This contest is not open for joining." });
        
        const isParticipant = contest.participants.some(p => p.userId.equals(req.user._id));
        if (isParticipant) {
            const populatedContest = await contest.populate('participants.userId', 'name');
            return res.status(200).json(populatedContest);
        }

        contest.participants.push({ userId: req.user._id, userName: req.user.name });
        contest.leaderboard.push({ userId: req.user._id, userName: req.user.name, score: 0, problemScores: [] });
        
        let updatedContest = await contest.save();
        updatedContest = await updatedContest.populate('participants.userId', 'name');
        req.io.to(roomId).emit('participant:joined', updatedContest.participants);
        res.status(200).json(updatedContest);
    } catch (error) {
        console.error("Error joining contest:", error);
        res.status(500).json({ message: "Server error while joining contest." });
    }
};


/**
 * Get contest lobby details (only participants)
 */
export const getContestLobbyDetails = async (req, res) => {
    try {
        const contest = await Contest.findOne({ roomId: req.params.id }).select('roomId createdBy participants status duration').populate('participants.userId', 'name');
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        const isParticipant = contest.participants.some(p => p.userId._id.equals(req.user._id));
        if (!isParticipant) {
            return res.status(403).json({ message: 'You have not joined this contest lobby.' });
        }
        res.json(contest);
    } catch (error) {
        console.error("Error getting lobby details:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * Start a contest (only creator)
 */
export const startContest = async (req, res) => {
  try {
    const contest = await Contest.findOne({ roomId: req.params.id });
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }
    if (!contest.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to start this contest" });
    }
    if (contest.status !== "waiting") {
      return res.status(400).json({ message: "Contest has already started or finished." });
    }
    contest.status = "inprogress";
    contest.startTime = new Date();
    contest.endTime = new Date(Date.now() + contest.duration * 60 * 1000);

    const updatedContest = await contest.save();

    req.io.to(contest.roomId).emit("contest:started", {
      startTime: updatedContest.startTime,
      endTime: updatedContest.endTime,
    });

    return res.json({ message: "Contest started successfully" });
  } catch (error) {
    console.error("Error starting contest:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

/**
 * Return contest questions (for participants)
 */
export const getContestQuestions = async (req, res) => {
    try {
        const contest = await Contest.findOne({ roomId: req.params.id });
        if (!contest) return res.status(404).json({ message: 'Contest not found' });

        const isParticipant = contest.participants.some(p => p.userId.equals(req.user._id));
        if (!isParticipant) return res.status(403).json({ message: 'User not authorized to access this contest' });
        
        const questionsForUser = contest.questions.map(q => ({
            _id: q._id,
            title: q.title,
            description: q.description,
            sampleInput: q.testCases.length > 0 ? q.testCases[0].input : "[]",
            starterCode: q.starterCode
        }));

        res.json({
            _id: contest._id,
            roomId: contest.roomId,
            startTime: contest.startTime,
            endTime: contest.endTime,
            questions: questionsForUser
        });
    } catch (error) {
        console.error("Error getting contest questions:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

/**
 * Get leaderboard (for participants)
 */
export const getLeaderboard = async (req, res) => {
  try {
    const contest = await Contest.findOne({ roomId: req.params.id });
    if (!contest) {
      return res.status(404).json({ message: "Contest not found" });
    }
    const isParticipant = contest.participants.some((p) => p.userId.equals(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ message: "User not authorized to access this contest leaderboard" });
    }
    const sortedLeaderboard = contest.leaderboard.sort((a, b) => b.score - a.score);
    return res.json(sortedLeaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};
