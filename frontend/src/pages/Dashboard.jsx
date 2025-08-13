import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import toast from 'react-hot-toast';
import { FaPlus, FaTrash, FaClipboardList, FaMagic } from 'react-icons/fa';
import BulkTestCaseModal from '../components/BulkTestCaseModal';
import { parseInputToTypes, generateStarterCode } from '../utils/codeGen';

const initialStarterCode = [
    { language: 'javascript', code: 'function solve(args) {\n  // Your logic here\n}' },
    { language: 'python', code: 'def solve(args):\n  # Your logic here\n  pass' },
    { language: 'java', code: 'class Solution {\n    // Your method here\n}' },
];

const newProblemTemplate = () => ({
    id: Date.now(),
    title: '',
    description: '',
    starterCode: initialStarterCode,
    testCases: [{ input: '', output: '' }],
});

const Dashboard = () => {
    const [duration, setDuration] = useState(30);
    const [roomId, setRoomId] = useState('');
    const [problems, setProblems] = useState([newProblemTemplate()]);
    const [modalState, setModalState] = useState({ isOpen: false, probIndex: null });
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const navigate = useNavigate();

    const handleAiGenerate = async () => {
        if (!aiPrompt) {
            toast.error("Please describe the problem you want to generate.");
            return;
        }
        setIsGenerating(true);
        const toastId = toast.loading("Generating question with AI...");
        try {
            const { data } = await API.post('/ai/generate-question', { prompt: aiPrompt });

            const newProblems = [...problems];
            newProblems[0] = {
                ...newProblemTemplate(),
                title: data.title,
                description: data.description,
                testCases: data.testCases,
            };
            setProblems(newProblems);
            toast.success("AI generated a new problem!", { id: toastId });

            setTimeout(() => updateStarterCodeForProblem(0, newProblems), 0);

        } catch (error) {
            toast.error(error.response?.data?.message || "AI generation failed.", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    const updateStarterCodeForProblem = (probIndex, currentProblems = problems) => {
        const problem = currentProblems[probIndex];
        const firstTestCase = problem.testCases[0];
        if (!firstTestCase || !problem.title) return;
        const inputTypes = parseInputToTypes(firstTestCase.input);
        const outputType = parseInputToTypes(firstTestCase.output);
        if (inputTypes) {
            const updatedProblems = [...currentProblems];
            updatedProblems[probIndex].starterCode = generateStarterCode(
                inputTypes, outputType ? outputType[0] : null, problem.title
            );
            setProblems(updatedProblems);
        }
    };

    const handleProblemChange = (index, field, value) => {
        const newProblems = [...problems];
        newProblems[index][field] = value;
        setProblems(newProblems);
        if (field === 'title') {
             updateStarterCodeForProblem(index, newProblems);
        }
    };

    const handleTestCaseChange = (probIndex, caseIndex, field, value) => {
        const newProblems = [...problems];
        newProblems[probIndex].testCases[caseIndex][field] = value;
        setProblems(newProblems);
        if (caseIndex === 0) {
            updateStarterCodeForProblem(probIndex, newProblems);
        }
    };

    const addTestCase = (probIndex) => {
        const newProblems = [...problems];
        newProblems[probIndex].testCases.push({ input: '', output: '' });
        setProblems(newProblems);
    };

    const removeTestCase = (probIndex, caseIndex) => {
        const newProblems = [...problems];
        if (newProblems[probIndex].testCases.length <= 1) {
            toast.error("A problem must have at least one test case.");
            return;
        }
        newProblems[probIndex].testCases.splice(caseIndex, 1);
        setProblems(newProblems);
    };

    const handleBulkAddTestCases = (newCases) => {
        if (!modalState.isOpen || modalState.probIndex === null) return;
        const probIndex = modalState.probIndex;
        const newProblems = [...problems];
        if (newProblems[probIndex].testCases.length === 1 && newProblems[probIndex].testCases[0].input === '' && newProblems[probIndex].testCases[0].output === '') {
            newProblems[probIndex].testCases = newCases;
        } else {
            newProblems[probIndex].testCases.push(...newCases);
        }
        setProblems(newProblems);
        updateStarterCodeForProblem(probIndex, newProblems);
    };

    const addProblem = () => {
        setProblems([...problems, newProblemTemplate()]);
    };

    const removeProblem = (index) => {
        if (problems.length <= 1) {
            toast.error("A contest must have at least one problem.");
            return;
        }
        const newProblems = [...problems];
        newProblems.splice(index, 1);
        setProblems(newProblems);
    };

    const handleCreateContest = async (e) => {
        e.preventDefault();
        const toastId = toast.loading('Creating custom contest...');
        try {
            const problemsToSubmit = problems.map(({ id, ...rest }) => rest);
            const { data } = await API.post('/contest/create', { duration, questions: problemsToSubmit });
            toast.success(`Contest room created!`, { id: toastId });
            navigate(`/contest/${data.roomId}/lobby`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create contest', { id: toastId });
        }
    };

    const handleJoinContest = async (e) => {
        e.preventDefault();
        if (!roomId) { toast.error("Please enter a Room ID."); return; }
        const toastId = toast.loading('Joining contest...');
        try {
            await API.post('/contest/join', { roomId });
            toast.success(`Joined contest!`, { id: toastId });
            navigate(`/contest/${roomId}/lobby`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to join contest', { id: toastId });
        }
    };

    return (
        <>
            <BulkTestCaseModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, probIndex: null })}
                onAddTestCases={handleBulkAddTestCases}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
                <div className="bg-gray-800 p-8 rounded-lg shadow-lg col-span-1 lg:col-span-2">
                    <div className="bg-indigo-900/30 p-6 rounded-lg border border-indigo-700 mb-8">
                         <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                            <FaMagic className="text-indigo-400" /> Create with AI
                        </h2>
                        <p className="text-gray-400 mb-4">Describe the problem you want (e.g., "an easy array problem about duplicates" or "a medium problem using a hash map"). The AI will generate the first problem for you.</p>
                        <div className="flex flex-col md:flex-row gap-4">
                            <textarea
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Describe the problem..."
                                rows="2"
                                className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={handleAiGenerate}
                                disabled={isGenerating}
                                className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? 'Generating...' : 'Generate Problem'}
                            </button>
                        </div>
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-6">Create or Edit Your Contest</h2>
                    <form onSubmit={handleCreateContest} className="space-y-8">
                        <div>
                            <label className="block text-gray-300 mb-2 font-semibold">Contest Duration (minutes)</label>
                            <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="10" max="180" required className="w-full md:w-1/3 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                        </div>
                        <div className="space-y-6">
                            {problems.map((problem, probIndex) => (
                                <div key={problem.id} className="bg-gray-900/50 p-6 rounded-lg border border-gray-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xl font-bold text-teal-400">Problem #{probIndex + 1}</h3>
                                        {problems.length > 1 && <button type="button" onClick={() => removeProblem(probIndex)} className="text-red-500 hover:text-red-400"><FaTrash /></button>}
                                    </div>
                                    <div className="space-y-4">
                                        <input type="text" placeholder="Problem Title" value={problem.title} onChange={(e) => handleProblemChange(probIndex, 'title', e.target.value)} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white" />
                                        <textarea placeholder="Problem Description" value={problem.description} onChange={(e) => handleProblemChange(probIndex, 'description', e.target.value)} required rows="4" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"></textarea>
                                        <div className="flex justify-between items-center pt-2">
                                            <h4 className="font-semibold text-gray-300">Test Cases</h4>
                                            <button type="button" onClick={() => setModalState({ isOpen: true, probIndex })} className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1 px-3 rounded-md flex items-center gap-2">
                                                <FaClipboardList /> Bulk Add
                                            </button>
                                        </div>
                                        {problem.testCases.map((tc, caseIndex) => (
                                            <div key={caseIndex} className="flex gap-4 items-center">
                                                <textarea placeholder="Input(s), comma-separated" value={tc.input} onChange={(e) => handleTestCaseChange(probIndex, caseIndex, 'input', e.target.value)} required rows="1" className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white font-mono text-sm"></textarea>
                                                <textarea placeholder="Expected Output" value={tc.output} onChange={(e) => handleTestCaseChange(probIndex, caseIndex, 'output', e.target.value)} required rows="1" className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-white font-mono text-sm"></textarea>
                                                {problem.testCases.length > 1 && <button type="button" onClick={() => removeTestCase(probIndex, caseIndex)} className="text-red-500 hover:text-red-400"><FaTrash /></button>}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addTestCase(probIndex)} className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-2"><FaPlus /> Add Single Test Case</button>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addProblem} className="w-full mt-4 py-2 border-2 border-dashed border-gray-600 hover:bg-gray-700 text-gray-300 font-bold rounded-md transition duration-200 flex items-center justify-center gap-2"><FaPlus /> Add Another Problem</button>
                        </div>
                        <button type="submit" className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-bold rounded-md transition duration-200 text-lg">Create Contest & Get Room Code</button>
                    </form>
                </div>
                <div className="bg-gray-800 p-8 rounded-lg shadow-lg col-span-1 lg:col-span-2">
                    <h2 className="text-2xl font-bold text-white mb-4">Or Join an Existing Contest</h2>
                    <form onSubmit={handleJoinContest} className="flex gap-4">
                        <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter Room Code" className="flex-grow px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button type="submit" className="py-2 px-6 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-md transition duration-200">Join Room</button>
                    </form>
                </div>
            </div>
        </>
    );
};

export default Dashboard;