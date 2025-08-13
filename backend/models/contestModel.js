import mongoose from 'mongoose';

const participantScoreSchema = mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    score: { type: Number, default: 0 },
    solvedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
}, { _id: false });

const contestSchema = mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    duration: { type: Number, required: true }, // in minutes
    status: {
        type: String,
        required: true,
        enum: ['waiting', 'inprogress', 'finished'],
        default: 'waiting',
    },
    startTime: { type: Date }, // Will be set when contest starts
    endTime: { type: Date },   // Will be set when contest starts
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    participants: [{ 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String }
     }],
    leaderboard: [participantScoreSchema]
}, { timestamps: true });

const Contest = mongoose.model('Contest', contestSchema);
export default Contest;