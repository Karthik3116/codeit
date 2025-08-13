import express from 'express';
import { 
    createContest, 
    joinContest, 
    getContestQuestions, 
    getLeaderboard,
    getContestLobbyDetails,
    startContest
} from '../controllers/contestController.js';
const router = express.Router();

router.post('/create', createContest);
router.post('/join', joinContest);
router.get('/:id/lobby', getContestLobbyDetails);
router.post('/:id/start', startContest);
router.get('/:id/questions', getContestQuestions);
router.get('/:id/leaderboard', getLeaderboard);

export default router;