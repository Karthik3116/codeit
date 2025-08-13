import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import API from '../api';

import CodeEditor from '../components/CodeEditor';
import Leaderboard from '../components/Leaderboard';
import CountdownTimer from '../components/CountdownTimer';
import { FaPlay, FaPaperPlane } from 'react-icons/fa';

const ContestRoom = () => {
    const { roomId } = useParams();
    const [contest, setContest] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [language, setLanguage] = useState('javascript');
    const [code, setCode] = useState('');
    const [output, setOutput] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const socket = useRef(null);
    
    const updateEditorCode = (qIndex, lang) => {
        if (questions.length > 0) {
            const starter = questions[qIndex].starterCode.find(sc => sc.language === lang);
            setCode(starter ? starter.code : `// No starter code for ${lang}`);
        }
    };
    
    useEffect(() => {
        socket.current = io('http://localhost:5000');
        socket.current.emit('joinRoom', roomId);

        const fetchContestData = async () => {
            try {
                const { data } = await API.get(`/contest/${roomId}/questions`);
                setContest(data);
                setQuestions(data.questions);
                const initialStarter = data.questions[0].starterCode.find(sc => sc.language === 'javascript');
                setCode(initialStarter ? initialStarter.code : '// Start coding here');
                
                const leaderboardRes = await API.get(`/contest/${roomId}/leaderboard`);
                setLeaderboard(leaderboardRes.data);
            } catch (error) {
                toast.error(error.response?.data?.message || "Failed to load contest.");
            }
        };
        fetchContestData();

        socket.current.on('leaderboard:update', (newLeaderboard) => {
            setLeaderboard(newLeaderboard);
            toast.success('Leaderboard updated!');
        });
        
        return () => {
            if (socket.current) socket.current.disconnect();
        };
    }, [roomId]);

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        updateEditorCode(currentQuestionIndex, newLang);
    };

    const handleQuestionChange = (index) => {
        setCurrentQuestionIndex(index);
        updateEditorCode(index, language);
    };
    
    const handleRunCode = async () => {
        setIsRunning(true);
        setOutput('');
        try {
            const currentProblem = questions[currentQuestionIndex];
            const { data } = await API.post('/code/run', {
                language,
                code,
                input: currentProblem.sampleInput,
                problemId: currentProblem._id // Pass problemId for context
            });
            if(data.type === 'error'){
                setOutput(`Error:\n${data.message}`);
            } else {
                 setOutput(`Output:\n${data.output}`);
            }
        } catch (error) {
            setOutput(`Error:\n${error.response?.data?.message || 'Execution failed'}`);
        } finally {
            setIsRunning(false);
        }
    };
    
    const handleSubmitCode = async () => {
        setIsSubmitting(true);
        setOutput('');
        const toastId = toast.loading("Submitting your solution...");
        try {
            const currentProblem = questions[currentQuestionIndex];
            const { data } = await API.post('/code/submit', {
                language,
                code,
                problemId: currentProblem._id,
                contestId: contest._id
            });
            
            if (data.success) {
                toast.success("Congratulations! All test cases passed.", { id: toastId });
                setOutput("Result: Accepted\nAll test cases passed!");
            } else {
                toast.error("Some test cases failed.", { id: toastId });
                setOutput(`Result: Wrong Answer\nFailed on a hidden test case.`);
            }
        } catch (error) {
             toast.error(error.response?.data?.message || 'Submission failed', { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!contest || questions.length === 0) {
        return <div className="text-center mt-20">Loading contest...</div>;
    }

    const currentProblem = questions[currentQuestionIndex];

    return (
        <div className="h-[calc(100vh-120px)] grid grid-cols-12 gap-4">
            {/* Left Panel */}
            <div className="col-span-3 bg-gray-800 p-4 rounded-lg overflow-y-auto">
                <h2 className="text-xl font-bold text-teal-400 mb-4">Problems</h2>
                {questions.map((q, index) => (
                    <div 
                        key={q._id} 
                        onClick={() => handleQuestionChange(index)}
                        className={`p-3 rounded-md cursor-pointer mb-2 transition ${
                            index === currentQuestionIndex ? 'bg-teal-500 text-white' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                        <h3 className="font-semibold">{index + 1}. {q.title}</h3>
                    </div>
                ))}
            </div>

            {/* Middle Panel */}
            <div className="col-span-6 flex flex-col gap-4">
                <div className="bg-gray-800 p-4 rounded-lg flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-2">{currentProblem.title}</h2>
                    <p className="text-gray-300 whitespace-pre-wrap">{currentProblem.description}</p>
                </div>
                 <div className="bg-gray-800 p-2 rounded-lg flex-shrink-0">
                    <label htmlFor="language-select" className="text-sm font-medium text-gray-300 mr-2">Language:</label>
                    <select 
                        id="language-select" 
                        value={language} 
                        onChange={handleLanguageChange}
                        className="bg-gray-700 text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                    </select>
                </div>
                <div className="flex-grow">
                    <CodeEditor code={code} setCode={setCode} language={language} />
                </div>
            </div>

            {/* Right Panel */}
            <div className="col-span-3 flex flex-col gap-4">
                {contest.endTime && <CountdownTimer endTime={contest.endTime} />}
                <div className="flex-grow">
                     <Leaderboard leaderboard={leaderboard} />
                </div>
                <div className="bg-gray-800 p-4 rounded-lg flex-shrink-0">
                    <h3 className="text-lg font-bold mb-2">Output</h3>
                    <pre className="bg-gray-900 text-white p-3 rounded-md h-32 overflow-y-auto text-sm">{output || 'Click "Run Code" to see output.'}</pre>
                    <div className="flex gap-4 mt-4">
                        <button onClick={handleRunCode} disabled={isRunning} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 disabled:opacity-50">
                            <FaPlay /> Run Code
                        </button>
                        <button onClick={handleSubmitCode} disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 disabled:opacity-50">
                           <FaPaperPlane /> Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContestRoom;