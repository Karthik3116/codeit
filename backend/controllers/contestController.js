import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import { nanoid } from 'nanoid';

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
            // FIX: Initialize leaderboard with new schema
            leaderboard: [{ 
                userId: req.user._id, 
                userName: req.user.name, 
                score: 0, 
                problemScores: [] 
            }]
        });
        
        const createdContest = await newContest.save();
        res.status(201).json(createdContest);
    } catch (error) {
        console.error("Error creating contest:", error);
        res.status(500).json({ message: "Server error while creating contest." });
    }
};




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
        // FIX: Initialize new participant with the new schema
        contest.leaderboard.push({ 
            userId: req.user._id, 
            userName: req.user.name, 
            score: 0, 
            problemScores: [] 
        });
        
        let updatedContest = await contest.save();
        updatedContest = await updatedContest.populate('participants.userId', 'name');
        req.io.to(roomId).emit('participant:joined', updatedContest.participants);
        res.status(200).json(updatedContest);
    } catch (error) {
        console.error("Error joining contest:", error);
        res.status(500).json({ message: "Server error while joining contest." });
    }
};

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

export const startContest = async (req, res) => {
    try {
        const contest = await Contest.findOne({ roomId: req.params.id });
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        if (!contest.createdBy.equals(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to start this contest' });
        }
        if (contest.status !== 'waiting') {
            return res.status(400).json({ message: 'Contest has already started or finished.' });
        }
        contest.status = 'inprogress';
        contest.startTime = new Date();
        contest.endTime = new Date(Date.now() + contest.duration * 60 * 1000);
        
        const updatedContest = await contest.save();
        
        req.io.to(contest.roomId).emit('contest:started', { 
            startTime: updatedContest.startTime,
            endTime: updatedContest.endTime 
        });

        res.json({ message: 'Contest started successfully' });
    } catch (error) {
        console.error("Error starting contest:", error);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getContestQuestions = async (req, res) => {
    try {
        // No longer need to populate, as questions are embedded
        const contest = await Contest.findOne({ roomId: req.params.id });
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }

        const isParticipant = contest.participants.some(p => p.userId.equals(req.user._id));
        if (!isParticipant) {
            return res.status(403).json({ message: 'User not authorized to access this contest' });
        }
        
        // Map the embedded questions to the format the frontend expects
        const questionsForUser = contest.questions.map(q => ({
            _id: q._id, // The embedded document has its own _id
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
        res.status(500).json({ message: "Server Error" });
    }
};
export const getLeaderboard = async (req, res) => {
    try {
        const contest = await Contest.findOne({ roomId: req.params.id });
        if (!contest) {
            return res.status(404).json({ message: 'Contest not found' });
        }
        const isParticipant = contest.participants.some(p => p.userId.equals(req.user._id));
        if (!isParticipant) {
            return res.status(403).json({ message: 'User not authorized to access this contest leaderboard' });
        }
        const sortedLeaderboard = contest.leaderboard.sort((a, b) => b.score - a.score);
        res.json(sortedLeaderboard);
    } catch (error) {
         res.status(500).json({ message: "Server Error" });
    }
};