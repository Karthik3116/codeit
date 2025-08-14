
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import API from '../api';
import CodeEditor from '../components/CodeEditor';
import Leaderboard from '../components/Leaderboard';
import CountdownTimer from '../components/CountdownTimer';
import { FaPlay, FaPaperPlane } from 'react-icons/fa';

const ContestRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [contest, setContest] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [language, setLanguage] = useState('javascript');
    
    const [allCode, setAllCode] = useState({
        javascript: '',
        python: '',
        java: '',
    });
    
    const [output, setOutput] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const socket = useRef(null);

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const initializeCodeState = (question) => {
        if (!question || !question.starterCode) return;
        const initialCodeState = { javascript: '', python: '', java: '' };
        question.starterCode.forEach(sc => {
            if (initialCodeState.hasOwnProperty(sc.language)) {
                initialCodeState[sc.language] = sc.code;
            }
        });
        setAllCode(initialCodeState);
    };

    useEffect(() => {
        const fetchContestData = async () => {
            try {
                const { data } = await API.get(`/contest/${roomId}/questions`);
                setContest(data);
                setQuestions(data.questions);
                if (data.questions.length > 0) {
                    initializeCodeState(data.questions[0]);
                }
                const leaderboardRes = await API.get(`/contest/${roomId}/leaderboard`);
                setLeaderboard(leaderboardRes.data);
            } catch (error) {
                toast.error(error.response?.data?.message || "Failed to load contest.");
                navigate("/dashboard");
            }
        };
        fetchContestData();
    }, [roomId, navigate]);

    useEffect(() => {
        socket.current = io(SOCKET_URL);
        socket.current.emit('joinRoom', roomId);

        const handleLeaderboardUpdate = (newLeaderboard) => {
            setLeaderboard(newLeaderboard);
            toast.success('Leaderboard updated!');
        };
        
        socket.current.on('leaderboard:update', handleLeaderboardUpdate);

        return () => {
            if (socket.current) {
                socket.current.off('leaderboard:update', handleLeaderboardUpdate);
                socket.current.disconnect();
            }
        };
    }, [roomId, SOCKET_URL]);

    const handleCodeChange = (newCode) => {
        setAllCode(prev => ({
            ...prev,
            [language]: newCode,
        }));
    };

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
    };

    const handleQuestionChange = (index) => {
        if (index === currentQuestionIndex) return;
        setCurrentQuestionIndex(index);
        initializeCodeState(questions[index]);
    };

    const handleRunCode = async () => {
        setIsRunning(true);
        setOutput('');
        try {
            const currentProblem = questions[currentQuestionIndex];
            const { data } = await API.post('/code/run', {
                language,
                code: allCode[language],
                input: currentProblem.sampleInput,
                problemId: currentProblem._id,
                contestId: contest._id
            });
            if (data.type === 'error') {
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
                code: allCode[language],
                problemId: currentProblem._id,
                contestId: contest._id
            });
            
            const { success, testCasesPassed, totalTestCases, score } = data;
            
            toast.dismiss(toastId);
            if (success) {
                toast.success(`Congratulations! All ${totalTestCases} test cases passed.`);
            } else {
                toast.error(`Submission failed. Passed ${testCasesPassed}/${totalTestCases} test cases.`);
            }
            setOutput(`Result: ${success ? 'Accepted' : 'Partial/Wrong Answer'}\nScore for this submission: ${score}\nPassed: ${testCasesPassed}/${totalTestCases}`);
        } catch (error) {
            toast.dismiss(toastId);
            toast.error(error.response?.data?.message || 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!contest || questions.length === 0) {
        return <div className="text-center mt-20">Loading contest...</div>;
    }

    const currentProblem = questions[currentQuestionIndex];

    return (
        <div className="flex gap-4 h-[calc(100vh-100px)]">
            <div className="flex flex-col w-1/2 gap-4">
                <div className="bg-gray-800 rounded-lg p-1 flex-shrink-0">
                    {questions.map((q, index) => (
                        <button
                            key={q._id}
                            onClick={() => handleQuestionChange(index)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                                index === currentQuestionIndex ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50'
                            }`}
                        >
                           {index + 1}. {q.title}
                        </button>
                    ))}
                </div>
                <div className="bg-gray-800 rounded-lg p-6 flex-grow overflow-y-auto">
                    <h2 className="text-2xl font-bold text-white mb-4">{currentProblem.title}</h2>
                    <div className="prose prose-invert max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: currentProblem.description.replace(/\n/g, '<br/>') }} />
                </div>
                <div className="h-1/3 flex-shrink-0">
                    <Leaderboard 
                        leaderboard={leaderboard} 
                        contestStartTime={contest.startTime} 
                    />
                </div>
            </div>

            <div className="flex flex-col w-1/2 gap-4">
                <div className="flex-grow flex flex-col bg-gray-800 rounded-lg">
                    <div className="flex justify-between items-center p-2 border-b border-gray-700 flex-shrink-0">
                        <select
                            value={language}
                            onChange={handleLanguageChange}
                            className="bg-gray-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="java">Java</option>
                        </select>
                        {contest.endTime && <CountdownTimer endTime={contest.endTime} />}
                    </div>
                    <div className="flex-grow">
                         <CodeEditor 
                            code={allCode[language]} 
                            setCode={handleCodeChange} 
                            language={language} 
                         />
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 flex-shrink-0">
                     <h3 className="text-lg font-semibold text-white mb-2">Output</h3>
                     <pre className="bg-gray-900 text-white p-3 rounded-md h-32 overflow-y-auto text-sm font-mono">{output || 'Execution output will appear here.'}</pre>
                     <div className="flex gap-4 mt-4 justify-end">
                        <button
                            onClick={handleRunCode}
                            disabled={isRunning}
                            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-5 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <FaPlay /> Run Code
                        </button>
                        <button
                            onClick={handleSubmitCode}
                            disabled={isSubmitting}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-5 rounded-md flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           <FaPaperPlane /> Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContestRoom;