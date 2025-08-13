import express from 'express';
import { generateQuestion } from '../controllers/aiController.js';

const router = express.Router();

// This route is protected, so only logged-in users can use it
router.post('/generate-question', generateQuestion);

export default router;