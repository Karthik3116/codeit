

// import { useEffect, useState, useRef } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import io from 'socket.io-client';
// import toast from 'react-hot-toast';
// import API from '../api';
// import useAuth from '../hooks/useAuth';
// import CodeEditor from '../components/CodeEditor';
// import Leaderboard from '../components/Leaderboard';
// import CountdownTimer from '../components/CountdownTimer';
// import ChatBox from '../components/ChatBox';
// import { FaPlay, FaPaperPlane, FaChevronLeft, FaChevronRight, FaClock, FaUsers, FaComments, FaTrophy, FaCode, FaTerminal } from 'react-icons/fa';

// const ContestRoom = () => {
//     const { roomId } = useParams();
//     const navigate = useNavigate();
//     const { user } = useAuth();
//     const [contest, setContest] = useState(null);
//     const [questions, setQuestions] = useState([]);
//     const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
//     const [language, setLanguage] = useState('java');
//     const [problemSolutions, setProblemSolutions] = useState({});
//     const [output, setOutput] = useState('');
//     const [leaderboard, setLeaderboard] = useState([]);
//     const [isRunning, setIsRunning] = useState(false);
//     const [isSubmitting, setIsSubmitting] = useState(false);
//     const [leftPanelTab, setLeftPanelTab] = useState('description');
//     const [rightPanelTab, setRightPanelTab] = useState('leaderboard');
//     const [messages, setMessages] = useState([]);
//     const [unreadMessages, setUnreadMessages] = useState(0);

//     // Resizable panels
//     const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
//     const [consoleHeight, setConsoleHeight] = useState(220);
//     const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
//     const [isResizingVertical, setIsResizingVertical] = useState(false);

//     const socket = useRef(null);
//     const editorWrapperRef = useRef(null);
//     const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

//     // contest end detection + overlay/confetti
//     const [ended, setEnded] = useState(false);
//     const [showFinalOverlay, setShowFinalOverlay] = useState(false);
//     const [confettiPieces, setConfettiPieces] = useState([]);

//     // Prevent page-level scroll / white gutters
//     useEffect(() => {
//         const prevOverflow = document.body.style.overflow;
//         const prevMargin = document.body.style.margin;
//         const prevPadding = document.body.style.padding;

//         document.body.style.overflow = 'hidden';
//         document.body.style.margin = '0';
//         document.body.style.padding = '0';

//         return () => {
//             document.body.style.overflow = prevOverflow;
//             document.body.style.margin = prevMargin;
//             document.body.style.padding = prevPadding;
//         };
//     }, []);

//     // Fetch contest & leaderboard
//     useEffect(() => {
//         const fetchContestData = async () => {
//             try {
//                 const { data } = await API.get(`/contest/${roomId}/questions`);
//                 setContest(data);
//                 setQuestions(data.questions || []);
//                 if (data.questions && data.questions.length > 0) {
//                     const initialSolutions = {};
//                     data.questions.forEach(q => {
//                         const initialCodeState = { javascript: '', python: '', java: '' };
//                         (q.starterCode || []).forEach(sc => {
//                             if (initialCodeState.hasOwnProperty(sc.language)) {
//                                 initialCodeState[sc.language] = sc.code;
//                             }
//                         });
//                         initialSolutions[q._id] = initialCodeState;
//                     });
//                     setProblemSolutions(initialSolutions);
//                 }
//                 const leaderboardRes = await API.get(`/contest/${roomId}/leaderboard`);
//                 setLeaderboard(leaderboardRes.data || []);
//             } catch (error) {
//                 toast.error(error.response?.data?.message || "Failed to load contest.");
//                 navigate("/dashboard");
//             }
//         };
//         fetchContestData();
//     }, [roomId, navigate]);

//     // Socket.IO setup
//     useEffect(() => {
//         socket.current = io(SOCKET_URL);
//         socket.current.emit('joinRoom', roomId);

//         const handleLeaderboardUpdate = (newLeaderboard) => {
//             setLeaderboard(newLeaderboard);
//             toast.success('Leaderboard updated!');
//         };
        
//         const handleNewMessage = (newMessage) => {
//             setMessages(prev => [...prev, newMessage]);
//             if (newMessage.user && newMessage.user.id !== (user.id || user._id)) {
//                 setUnreadMessages(prev => prev + 1);
//             }
//         };

//         socket.current.on('leaderboard:update', handleLeaderboardUpdate);
//         socket.current.on('chat:message', handleNewMessage);

//         return () => {
//             if (socket.current) {
//                 socket.current.disconnect();
//             }
//         };
//     }, [roomId, SOCKET_URL, user]);

//     // Panel resizing handlers
//     const handleHorizontalResize = (e) => {
//         if (!isResizingHorizontal) return;
//         const newWidth = (e.clientX / window.innerWidth) * 100;
//         if (newWidth >= 18 && newWidth <= 75) {
//             setLeftPanelWidth(newWidth);
//         }
//     };

//     const handleVerticalResize = (e) => {
//         if (!isResizingVertical) return;
//         const newHeight = window.innerHeight - e.clientY;
//         if (newHeight >= 120 && newHeight <= window.innerHeight * 0.7) {
//              setConsoleHeight(newHeight);
//         }
//     };

//     const stopResizing = () => {
//         setIsResizingHorizontal(false);
//         setIsResizingVertical(false);
//         window.removeEventListener('mousemove', handleHorizontalResize);
//         window.removeEventListener('mousemove', handleVerticalResize);
//         window.removeEventListener('mouseup', stopResizing);
//     };

//     useEffect(() => {
//         if (isResizingHorizontal) {
//             window.addEventListener('mousemove', handleHorizontalResize);
//             window.addEventListener('mouseup', stopResizing);
//         }
//         if (isResizingVertical) {
//             window.addEventListener('mousemove', handleVerticalResize);
//             window.addEventListener('mouseup', stopResizing);
//         }
//         return () => {
//             window.removeEventListener('mousemove', handleHorizontalResize);
//             window.removeEventListener('mousemove', handleVerticalResize);
//             window.removeEventListener('mouseup', stopResizing);
//         };
//     }, [isResizingHorizontal, isResizingVertical]);

//     // Code change
//     const handleCodeChange = (newCode) => {
//         const currentProblemId = questions[currentQuestionIndex]?._id;
//         if (!currentProblemId) return;
//         setProblemSolutions(prev => ({
//             ...prev,
//             [currentProblemId]: { ...prev[currentProblemId], [language]: newCode }
//         }));
//     };

//     // Run / Submit
//     const handleRunSubmit = async (type) => {
//         const currentProblem = questions[currentQuestionIndex];
//         if (!currentProblem) return;
//         const currentCode = problemSolutions[currentProblem._id]?.[language] || '';
//         const endpoint = type === 'run' ? '/code/run' : '/code/submit';
//         const setLoading = type === 'run' ? setIsRunning : setIsSubmitting;

//         setLoading(true);
//         setOutput('');
//         const toastId = type === 'submit' ? toast.loading("Submitting your solution...") : null;

//         try {
//             const { data } = await API.post(endpoint, {
//                 language,
//                 code: currentCode,
//                 problemId: currentProblem._id,
//                 contestId: contest._id,
//                 input: type === 'run' ? currentProblem.sampleInput : undefined,
//             });

//             if (toastId) toast.dismiss(toastId);

//             if (type === 'run') {
//                 setOutput(data.type === 'error' ? `Error:\n${data.message}` : `Output:\n${data.output}`);
//             } else {
//                 const { success, testCasesPassed, totalTestCases, score } = data;
//                 if (success) {
//                     toast.success(`Congratulations! All ${totalTestCases} test cases passed.`);
//                 } else {
//                     toast.error(`Submission failed. Passed ${testCasesPassed}/${totalTestCases} test cases.`);
//                 }
//                 setOutput(`Result: ${success ? 'Accepted' : 'Partial/Wrong Answer'}\nScore for this submission: ${score}\nPassed: ${testCasesPassed}/${totalTestCases}`);
//             }
//         } catch (error) {
//             if (toastId) toast.dismiss(toastId);
//             const errorMessage = error.response?.data?.message || `${type === 'run' ? 'Execution' : 'Submission'} failed`;
//             toast.error(errorMessage);
//             setOutput(`Error:\n${errorMessage}`);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const handleRightPanelTabChange = (tab) => {
//         setRightPanelTab(tab);
//         if (tab === 'chat') {
//             setUnreadMessages(0);
//         }
//     };

//     // Keyboard shortcuts (capture-phase so editors don't swallow them)
//     useEffect(() => {
//         const onKeyDownCapture = (e) => {
//             const isMod = e.ctrlKey || e.metaKey;
//             if (!isMod) return;

//             const activeEl = document.activeElement;
//             const isInTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
//             const isFocusInEditor = editorWrapperRef.current && editorWrapperRef.current.contains(activeEl);

//             // Run: Ctrl/Cmd + '
//             if (e.key === "'" || e.key === "’") {
//                 if (isInTextInput && !isFocusInEditor) return;
//                 e.preventDefault();
//                 if (!isRunning) handleRunSubmit('run');
//                 return;
//             }

//             // Submit: Ctrl/Cmd + Enter
//             if (e.key === 'Enter') {
//                 if (isInTextInput && !isFocusInEditor) return;
//                 e.preventDefault();
//                 if (!isSubmitting) handleRunSubmit('submit');
//             }
//         };

//         window.addEventListener('keydown', onKeyDownCapture, true);
//         return () => window.removeEventListener('keydown', onKeyDownCapture, true);
//     }, [isRunning, isSubmitting, problemSolutions, questions, language, contest]);

//     // Contest end detection: poll every second
//     useEffect(() => {
//         if (!contest || !contest.endTime) return;
//         const checkEnded = () => {
//             try {
//                 const end = new Date(contest.endTime).getTime();
//                 if (!isNaN(end) && Date.now() >= end) {
//                     setEnded(true);
//                 }
//             } catch (e) {
//                 // ignore parse errors
//             }
//         };
//         checkEnded();
//         const id = setInterval(checkEnded, 1000);
//         return () => clearInterval(id);
//     }, [contest]);

//     // When contest ends, show overlay and generate confetti
//     useEffect(() => {
//         if (!ended) return;

//         setShowFinalOverlay(true);

//         // generate confetti pieces
//         const colors = ['#ff4d4f', '#ffa940', '#ffd666', '#73d13d', '#36cfc9', '#40a9ff', '#9254de'];
//         const pieces = Array.from({ length: 36 }).map((_, i) => ({
//             id: i,
//             left: Math.random() * 100, // percentage
//             delay: (Math.random() * 2).toFixed(2) + 's',
//             duration: (4 + Math.random() * 4).toFixed(2) + 's',
//             size: 6 + Math.round(Math.random() * 10),
//             color: colors[Math.floor(Math.random() * colors.length)],
//             rotate: Math.round(Math.random() * 360)
//         }));
//         setConfettiPieces(pieces);

//         // stop confetti after 8s (keeps overlay visible until user leaves)
//         const t = setTimeout(() => setConfettiPieces([]), 8000);
//         return () => clearTimeout(t);
//     }, [ended]);

//     if (!contest || questions.length === 0) {
//         return (
//             <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
//                 <div className="text-center">
//                     <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-500 mb-4"></div>
//                     <div className="text-xl text-white">Loading contest...</div>
//                 </div>
//             </div>
//         );
//     }

//     const currentProblem = questions[currentQuestionIndex];
//     const codeForEditor = problemSolutions[currentProblem?._id]?.[language] || '';

//     return (
//         <div className="fixed inset-0 bg-gray-900 text-white flex flex-col" style={{ zIndex: 999 }}>
//             {/* Inline CSS for confetti animation */}
//             <style>{`
//                 @keyframes confettiFall {
//                     0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
//                     100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
//                 }
//                 @keyframes confettiSwing {
//                     0% { transform: translateX(0px); }
//                     50% { transform: translateX(12px); }
//                     100% { transform: translateX(0px); }
//                 }
//                 .confetti-piece {
//                     position: absolute;
//                     top: -10vh;
//                     will-change: transform, opacity;
//                     pointer-events: none;
//                     border-radius: 2px;
//                 }
//                 .final-overlay {
//                     animation: fadeIn .2s ease-out;
//                 }
//                 @keyframes fadeIn {
//                     from { opacity: 0; transform: scale(0.98); }
//                     to { opacity: 1; transform: scale(1); }
//                 }
//             `}</style>

//             {/* Top Navigation */}
//             <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
//                  <div className="flex items-center space-x-4">
//                      <h1 className="text-lg font-bold text-blue-400">CodeIt</h1>
//                      <div className="flex items-center space-x-2 text-sm text-gray-400">
//                          <FaClock className="text-orange-400" />
//                          {contest.endTime && <CountdownTimer endTime={contest.endTime} />}
//                      </div>
//                  </div>
//                  <div className="flex items-center space-x-4">
//                      <div className="flex items-center space-x-2 text-sm text-gray-400">
//                          <FaUsers />
//                          <span>{leaderboard.length} participants</span>
//                      </div>
//                      <h2 className="font-semibold">{user.name}</h2>
//                      <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-colors">
//                          Logout
//                      </button>
//                  </div>
//             </header>

//             {/* Question Navigation */}
//             <nav className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
//                 <div className="flex items-center space-x-2 overflow-x-auto">
//                     {questions.map((q, index) => (
//                         <button key={q._id} onClick={() => setCurrentQuestionIndex(index)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${index === currentQuestionIndex ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
//                             {index + 1}. {q.title}
//                         </button>
//                     ))}
//                 </div>
//                 <div className="flex items-center space-x-2 flex-shrink-0">
//                     <span className="text-sm text-gray-400">{currentQuestionIndex + 1} / {questions.length}</span>
//                     <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0} className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg"><FaChevronLeft /></button>
//                     <button onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))} disabled={currentQuestionIndex === questions.length - 1} className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg"><FaChevronRight /></button>
//                 </div>
//             </nav>

//             {/* Main content */}
//             <main className="flex-1 flex flex-row overflow-hidden">
//                 {/* Left Panel */}
//                 <div style={{ width: `${leftPanelWidth}%` }} className="bg-gray-800 flex flex-col min-w-0">
//                     <div className="flex border-b border-gray-700 flex-shrink-0">
//                         <button className="flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center space-x-2 bg-gray-750 text-white border-b-2 border-blue-500"><FaCode /> <span>Description</span></button>
//                     </div>
//                     <div className="flex-1 overflow-auto p-6 min-w-0">
//                         <article className="prose prose-invert max-w-none text-gray-300">
//                             <h2 className="text-lg">{currentProblem.title}</h2>
//                             <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: (currentProblem.description || '').replace(/\n/g, '<br/>') }} />
//                             {currentProblem.sampleInput && <><h4 className="mt-4">Example Input:</h4><pre className="text-xs p-2 bg-gray-900 rounded">{currentProblem.sampleInput}</pre></>}
//                             {currentProblem.sampleOutput && <><h4 className="mt-2">Example Output:</h4><pre className="text-xs p-2 bg-gray-900 rounded">{currentProblem.sampleOutput}</pre></>}
//                         </article>
//                     </div>
//                 </div>

//                 {/* Horizontal Resizer */}
//                 <div
//                     onMouseDown={() => setIsResizingHorizontal(true)}
//                     className="w-1.5 bg-gray-700 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
//                     title="Drag to resize"
//                 />

//                 {/* Center & Right */}
//                 <div className="flex-1 w-0 flex flex-row overflow-hidden min-w-0">
//                     {/* Center Editor + Console */}
//                     <div className="flex-1 flex flex-col overflow-hidden min-w-0">
//                         <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
//                             <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
//                                 <option value="javascript">JavaScript</option>
//                                 <option value="python">Python</option>
//                                 <option value="java">Java</option>
//                             </select>
//                             <div className="flex items-center space-x-2">
//                                 <button title="Run (Ctrl/Cmd + ')" onClick={() => handleRunSubmit('run')} disabled={isRunning} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors text-sm">
//                                     <FaPlay /> <span>{isRunning ? 'Running...' : "Run (Ctrl + ')"} </span>
//                                 </button>
//                                 <button title="Submit (Ctrl/Cmd + Enter)" onClick={() => handleRunSubmit('submit')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors text-sm">
//                                     <FaPaperPlane /> <span>{isSubmitting ? 'Submitting...' : 'Submit (Ctrl + Enter)'}</span>
//                                 </button>
//                             </div>
//                         </header>

//                         <div className="flex-1 bg-gray-900 overflow-hidden min-w-0">
//                             <div ref={editorWrapperRef} className="w-full h-full code-editor" tabIndex={0}>
//                                 <CodeEditor code={codeForEditor} setCode={handleCodeChange} language={language} />
//                             </div>
//                         </div>

//                         <div onMouseDown={() => setIsResizingVertical(true)} className="h-1.5 bg-gray-800 border-t border-gray-700 cursor-row-resize hover:bg-blue-500 transition-colors flex-shrink-0"/>

//                         <div style={{ height: `${consoleHeight}px` }} className="bg-gray-800 flex flex-col overflow-hidden flex-shrink-0 min-w-0">
//                             <h3 className="text-sm font-semibold text-gray-300 p-2 border-b border-gray-700 flex-shrink-0">Console Output</h3>
//                             <div className="bg-gray-900 flex-1 p-4 overflow-auto">
//                                 <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
//                                     {output || 'Run or submit your code to see the output here...'}
//                                 </pre>
//                             </div>
//                         </div>
//                     </div>

//                     {/* Right Panel */}
//                     <div className="w-80 flex flex-col bg-gray-800 border-l border-gray-700 flex-shrink-0 min-w-0">
//                         <div className="flex border-b border-gray-700 flex-shrink-0">
//                             <button onClick={() => handleRightPanelTabChange('leaderboard')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center space-x-2 ${rightPanelTab === 'leaderboard' ? 'bg-gray-750 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700'}`}><FaTrophy /> <span>Leaderboard</span></button>
//                             <button onClick={() => handleRightPanelTabChange('chat')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center space-x-2 relative ${rightPanelTab === 'chat' ? 'bg-gray-750 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700'}`}>
//                                 <FaComments /> <span>Chat</span>
//                                 {unreadMessages > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadMessages}</span>}
//                             </button>
//                         </div>
//                         <div className="flex-1 overflow-auto min-w-0">
//                             {rightPanelTab === 'leaderboard' && <Leaderboard leaderboard={leaderboard} contestStartTime={contest.startTime} />}
//                             {rightPanelTab === 'chat' && <ChatBox socket={socket.current} user={user} roomId={roomId} messages={messages} setMessages={setMessages} />}
//                         </div>
//                     </div>
//                 </div>
//             </main>

//             {/* Final overlay when contest ended */}
//             {showFinalOverlay && (
//                 <div className="fixed inset-0 z-50 flex items-center justify-center">
//                     {/* dim background */}
//                     <div className="absolute inset-0 bg-black/60" />

//                     {/* confetti pieces */}
//                     {confettiPieces.map(p => (
//                         <div
//                             key={p.id}
//                             className="confetti-piece"
//                             style={{
//                                 left: `${p.left}%`,
//                                 background: p.color,
//                                 width: `${p.size}px`,
//                                 height: `${p.size * 0.6}px`,
//                                 transform: `rotate(${p.rotate}deg)`,
//                                 animation: `confettiFall ${p.duration} linear ${p.delay}, confettiSwing ${0.8 + Math.random()}s ease-in-out ${p.delay} infinite`,
//                                 borderRadius: '2px',
//                                 opacity: 0.95,
//                             }}
//                         />
//                     ))}

//                     {/* modal */}
//                     <div className="relative bg-gray-800 rounded-lg p-6 w-[min(920px,92%)] final-overlay shadow-2xl">
//                         <div className="flex items-center justify-between mb-4">
//                             <div className="flex items-center space-x-3">
//                                 <FaTrophy className="text-2xl text-yellow-400" />
//                                 <div>
//                                     <h2 className="text-2xl font-bold">Contest Finished</h2>
//                                     <div className="text-sm text-gray-300">Thanks for participating — here is the final leaderboard.</div>
//                                 </div>
//                             </div>
//                             <div>
//                                 <button onClick={() => { setShowFinalOverlay(false); }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded mr-2">Close</button>
//                                 <button onClick={() => navigate('/dashboard')} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white">Go Home</button>
//                             </div>
//                         </div>

//                         {/* Use Leaderboard component if it takes a reasonable size */}
//                         <div className="max-h-[60vh] overflow-auto">
//                             <Leaderboard leaderboard={leaderboard} contestStartTime={contest.startTime} finalView />
//                         </div>
//                     </div>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default ContestRoom;


import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import API from '../api';
import useAuth from '../hooks/useAuth';
import CodeEditor from '../components/CodeEditor';
import Leaderboard from '../components/Leaderboard';
import CountdownTimer from '../components/CountdownTimer';
import ChatBox from '../components/ChatBox';
import { FaPlay, FaPaperPlane, FaChevronLeft, FaChevronRight, FaClock, FaUsers, FaComments, FaTrophy, FaCode, FaTerminal } from 'react-icons/fa';

const ContestRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [contest, setContest] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [language, setLanguage] = useState('java');
    const [problemSolutions, setProblemSolutions] = useState({});
    const [output, setOutput] = useState('');
    const [leaderboard, setLeaderboard] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rightPanelTab, setRightPanelTab] = useState('leaderboard');
    const [messages, setMessages] = useState([]);
    const [unreadMessages, setUnreadMessages] = useState(0);

    // Resizable panels
    const [leftPanelWidth, setLeftPanelWidth] = useState(30); // percentage
    const [consoleHeight, setConsoleHeight] = useState(220);
    const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
    const [isResizingVertical, setIsResizingVertical] = useState(false);

    const socket = useRef(null);
    const editorWrapperRef = useRef(null);
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    // contest end detection + overlay/confetti
    const [ended, setEnded] = useState(false);
    const [showFinalOverlay, setShowFinalOverlay] = useState(false);
    const [confettiPieces, setConfettiPieces] = useState([]);

    // Prevent page-level scroll / white gutters
    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        const prevMargin = document.body.style.margin;
        const prevPadding = document.body.style.padding;

        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';

        return () => {
            document.body.style.overflow = prevOverflow;
            document.body.style.margin = prevMargin;
            document.body.style.padding = prevPadding;
        };
    }, []);

    // Fetch contest & leaderboard
    useEffect(() => {
        const fetchContestData = async () => {
            try {
                const { data } = await API.get(`/contest/${roomId}/questions`);
                setContest(data);
                setQuestions(data.questions || []);
                if (data.questions && data.questions.length > 0) {
                    const initialSolutions = {};
                    data.questions.forEach(q => {
                        const initialCodeState = { javascript: '', python: '', java: '' };
                        (q.starterCode || []).forEach(sc => {
                            if (initialCodeState.hasOwnProperty(sc.language)) {
                                initialCodeState[sc.language] = sc.code;
                            }
                        });
                        initialSolutions[q._id] = initialCodeState;
                    });
                    setProblemSolutions(initialSolutions);
                }
                const leaderboardRes = await API.get(`/contest/${roomId}/leaderboard`);
                setLeaderboard(leaderboardRes.data || []);
            } catch (error) {
                toast.error(error.response?.data?.message || "Failed to load contest.");
                navigate("/dashboard");
            }
        };
        fetchContestData();
    }, [roomId, navigate]);

    // Socket.IO setup
    useEffect(() => {
        socket.current = io(SOCKET_URL);
        socket.current.emit('joinRoom', roomId);

        const handleLeaderboardUpdate = (newLeaderboard) => {
            setLeaderboard(newLeaderboard);
            toast.success('Leaderboard updated!');
        };
        
        const handleNewMessage = (newMessage) => {
            setMessages(prev => [...prev, newMessage]);
            if (newMessage.user && newMessage.user.id !== (user.id || user._id)) {
                setUnreadMessages(prev => prev + 1);
            }
        };

        socket.current.on('leaderboard:update', handleLeaderboardUpdate);
        socket.current.on('chat:message', handleNewMessage);

        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }
        };
    }, [roomId, SOCKET_URL, user]);

    // Panel resizing handlers
    const handleHorizontalResize = (e) => {
        if (!isResizingHorizontal) return;
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth >= 18 && newWidth <= 75) {
            setLeftPanelWidth(newWidth);
        }
    };

    const handleVerticalResize = (e) => {
        if (!isResizingVertical) return;
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight >= 120 && newHeight <= window.innerHeight * 0.7) {
             setConsoleHeight(newHeight);
        }
    };

    const stopResizing = () => {
        setIsResizingHorizontal(false);
        setIsResizingVertical(false);
        window.removeEventListener('mousemove', handleHorizontalResize);
        window.removeEventListener('mousemove', handleVerticalResize);
        window.removeEventListener('mouseup', stopResizing);
    };

    useEffect(() => {
        if (isResizingHorizontal) {
            window.addEventListener('mousemove', handleHorizontalResize);
            window.addEventListener('mouseup', stopResizing);
        }
        if (isResizingVertical) {
            window.addEventListener('mousemove', handleVerticalResize);
            window.addEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', handleHorizontalResize);
            window.removeEventListener('mousemove', handleVerticalResize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizingHorizontal, isResizingVertical]);

    // Code change
    const handleCodeChange = (newCode) => {
        const currentProblemId = questions[currentQuestionIndex]?._id;
        if (!currentProblemId) return;
        setProblemSolutions(prev => ({
            ...prev,
            [currentProblemId]: { ...prev[currentProblemId], [language]: newCode }
        }));
    };

    // Run / Submit
    const handleRunSubmit = async (type) => {
        const currentProblem = questions[currentQuestionIndex];
        if (!currentProblem) return;
        const currentCode = problemSolutions[currentProblem._id]?.[language] || '';
        const endpoint = type === 'run' ? '/code/run' : '/code/submit';
        const setLoading = type === 'run' ? setIsRunning : setIsSubmitting;

        setLoading(true);
        setOutput('');
        const toastId = type === 'submit' ? toast.loading("Submitting your solution...") : null;

        try {
            const { data } = await API.post(endpoint, {
                language,
                code: currentCode,
                problemId: currentProblem._id,
                contestId: contest._id,
                input: type === 'run' ? currentProblem.sampleInput : undefined,
            });

            if (toastId) toast.dismiss(toastId);

            if (type === 'run') {
                setOutput(data.type === 'error' ? `Error:\n${data.message}` : `Output:\n${data.output}`);
            } else {
                const { success, testCasesPassed, totalTestCases, score } = data;
                if (success) {
                    toast.success(`Congratulations! All ${totalTestCases} test cases passed.`);
                } else {
                    toast.error(`Submission failed. Passed ${testCasesPassed}/${totalTestCases} test cases.`);
                }
                setOutput(`Result: ${success ? 'Accepted' : 'Partial/Wrong Answer'}\nScore for this submission: ${score}\nPassed: ${testCasesPassed}/${totalTestCases}`);
            }
        } catch (error) {
            if (toastId) toast.dismiss(toastId);
            const errorMessage = error.response?.data?.message || `${type === 'run' ? 'Execution' : 'Submission'} failed`;
            toast.error(errorMessage);
            setOutput(`Error:\n${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRightPanelTabChange = (tab) => {
        setRightPanelTab(tab);
        if (tab === 'chat') {
            setUnreadMessages(0);
        }
    };

    // Keyboard shortcuts (capture-phase so editors don't swallow them)
    useEffect(() => {
        const onKeyDownCapture = (e) => {
            const isMod = e.ctrlKey || e.metaKey;
            if (!isMod) return;

            const activeEl = document.activeElement;
            const isInTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
            const isFocusInEditor = editorWrapperRef.current && editorWrapperRef.current.contains(activeEl);

            // Run: Ctrl/Cmd + '
            if (e.key === "'" || e.key === "’") {
                if (isInTextInput && !isFocusInEditor) return;
                e.preventDefault();
                if (!isRunning) handleRunSubmit('run');
                return;
            }

            // Submit: Ctrl/Cmd + Enter
            if (e.key === 'Enter') {
                if (isInTextInput && !isFocusInEditor) return;
                e.preventDefault();
                if (!isSubmitting) handleRunSubmit('submit');
            }
        };

        window.addEventListener('keydown', onKeyDownCapture, true);
        return () => window.removeEventListener('keydown', onKeyDownCapture, true);
    }, [isRunning, isSubmitting, problemSolutions, questions, language, contest]);

    // Contest end detection: poll every second
    useEffect(() => {
        if (!contest || !contest.endTime) return;
        const checkEnded = () => {
            try {
                const end = new Date(contest.endTime).getTime();
                if (!isNaN(end) && Date.now() >= end) {
                    setEnded(true);
                }
            } catch (e) {
                // ignore parse errors
            }
        };
        checkEnded();
        const id = setInterval(checkEnded, 1000);
        return () => clearInterval(id);
    }, [contest]);

    // When contest ends, show overlay and generate confetti
    useEffect(() => {
        if (!ended) return;

        setShowFinalOverlay(true);

        // generate confetti pieces
        const colors = ['#ff4d4f', '#ffa940', '#ffd666', '#73d13d', '#36cfc9', '#40a9ff', '#9254de'];
        const pieces = Array.from({ length: 36 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100, // percentage
            delay: (Math.random() * 2).toFixed(2) + 's',
            duration: (4 + Math.random() * 4).toFixed(2) + 's',
            size: 6 + Math.round(Math.random() * 10),
            color: colors[Math.floor(Math.random() * colors.length)],
            rotate: Math.round(Math.random() * 360)
        }));
        setConfettiPieces(pieces);

        // stop confetti after 8s (keeps overlay visible until user leaves)
        const t = setTimeout(() => setConfettiPieces([]), 8000);
        return () => clearTimeout(t);
    }, [ended]);

    // Helper: format description text (remove backticks, convert **bold** to <strong>, preserve paragraphs)
    const formatDescriptionToHTML = (raw) => {
        if (!raw) return '';
        // Remove backticks ` and triple backticks
        let s = raw.replace(/```/g, '').replace(/`/g, '');
        // Convert **bold** to <strong>
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Convert lines starting with **Heading:** into <strong>Heading:</strong>
        s = s.replace(/\n\s*\*\*(.+?):\*\*/g, '<br/><strong>$1:</strong>');
        // Convert single newline to <br/>
        s = s.replace(/\n/g, '<br/>');
        return s;
    };

    // Helper: find Example Input from sampleInput or description. Return array or null.
    const extractExampleInput = (problem) => {
        // Prefer explicit sampleInput field
        if (problem.sampleInput) {
            const candidate = problem.sampleInput.trim();
            try {
                // try JSON parse
                const parsed = JSON.parse(candidate);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                // not JSON, try to parse bracketed numbers like [1,2,3]
                const match = candidate.match(/\[.*\]/);
                if (match) {
                    try {
                        return JSON.parse(match[0]);
                    } catch (err) { /* fallthrough */ }
                }
            }
        }
        // fallback: try to read "Example Input:" from description
        if (problem.description) {
            const desc = problem.description;
            const regex = /Example Input:\s*([\[\{].*?[\]\}])/s;
            const m = desc.match(regex);
            if (m && m[1]) {
                try {
                    const parsed = JSON.parse(m[1]);
                    if (Array.isArray(parsed)) return parsed;
                } catch (err) {
                    // attempt to extract numbers
                    const nums = m[1].match(/-?\d+/g);
                    if (nums) return nums.map(n => Number(n));
                }
            }
        }
        return null;
    };

    // Computes first non-repeating element (returns number or -1)
    const computeFirstNonRepeating = (arr) => {
        if (!Array.isArray(arr)) return -1;
        const counts = new Map();
        for (const x of arr) counts.set(x, (counts.get(x) || 0) + 1);
        for (const x of arr) if (counts.get(x) === 1) return x;
        return -1;
    };

    if (!contest || questions.length === 0) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-500 mb-4"></div>
                    <div className="text-xl text-white">Loading contest...</div>
                </div>
            </div>
        );
    }

    const currentProblem = questions[currentQuestionIndex];
    const codeForEditor = problemSolutions[currentProblem?._id]?.[language] || '';

    // Format description HTML
    const formattedDescriptionHTML = formatDescriptionToHTML(currentProblem.description || currentProblem.body || '');

    // Extract example input (if available) and compute answer
    const exampleInputArr = extractExampleInput(currentProblem);
    const exampleAnswer = exampleInputArr ? computeFirstNonRepeating(exampleInputArr) : null;

    return (
        <div className="fixed inset-0 bg-gray-900 text-white flex flex-col" style={{ zIndex: 999 }}>
            {/* Inline CSS for confetti animation */}
            <style>{`
                @keyframes confettiFall {
                    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
                }
                @keyframes confettiSwing {
                    0% { transform: translateX(0px); }
                    50% { transform: translateX(12px); }
                    100% { transform: translateX(0px); }
                }
                .confetti-piece {
                    position: absolute;
                    top: -10vh;
                    will-change: transform, opacity;
                    pointer-events: none;
                    border-radius: 2px;
                }
                .final-overlay {
                    animation: fadeIn .2s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>

            {/* Top Navigation */}
            <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
                 <div className="flex items-center space-x-4">
                     <h1 className="text-lg font-bold text-blue-400">CodeIt</h1>
                     <div className="flex items-center space-x-2 text-sm text-gray-400">
                         <FaClock className="text-orange-400" />
                         {contest.endTime && <CountdownTimer endTime={contest.endTime} />}
                     </div>
                 </div>
                 <div className="flex items-center space-x-4">
                     <div className="flex items-center space-x-2 text-sm text-gray-400">
                         <FaUsers />
                         <span>{leaderboard.length} participants</span>
                     </div>
                     <h2 className="font-semibold">{user.name}</h2>
                     <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-colors">
                         Logout
                     </button>
                 </div>
            </header>

            {/* Question Navigation */}
            <nav className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-2 overflow-x-auto">
                    {questions.map((q, index) => (
                        <button key={q._id} onClick={() => setCurrentQuestionIndex(index)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${index === currentQuestionIndex ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                            {index + 1}. {q.title}
                        </button>
                    ))}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-sm text-gray-400">{currentQuestionIndex + 1} / {questions.length}</span>
                    <button onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))} disabled={currentQuestionIndex === 0} className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg"><FaChevronLeft /></button>
                    <button onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))} disabled={currentQuestionIndex === questions.length - 1} className="p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg"><FaChevronRight /></button>
                </div>
            </nav>

            {/* Main content */}
            <main className="flex-1 flex flex-row overflow-hidden">
                {/* Left Panel */}
                <div style={{ width: `${leftPanelWidth}%` }} className="bg-gray-800 flex flex-col min-w-0">
                    <div className="flex border-b border-gray-700 flex-shrink-0">
                        <div className="flex-1 py-3 px-4">
                            {/* Increased question font size */}
                            <h2 className="text-2xl font-extrabold text-white">{currentProblem.title}</h2>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6 min-w-0">
                        {/* Render formatted description */}
                        <div className="text-gray-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedDescriptionHTML }} />

                        {/* If sample input exists — show example and computed AI answer */}
                        {exampleInputArr && (
                            <div className="mt-6">
                                <h4 className="text-white font-semibold mb-2">Example Input</h4>
                                <pre className="bg-gray-900 p-3 rounded text-xs overflow-auto">{JSON.stringify(exampleInputArr)}</pre>

                                 
                            </div>
                        )}

                        {/* If there is no sample input, show a helpful note */}
                        {!exampleInputArr && (
                            <div className="mt-6 text-sm text-gray-400">
                                No example input found in the problem data. If you provide an example like <span className="font-mono">[1,2,3,1,2,4]</span> it will be parsed and the first non-repeating element will be shown here.
                            </div>
                        )}
                    </div>
                </div>

                {/* Horizontal Resizer */}
                <div
                    onMouseDown={() => setIsResizingHorizontal(true)}
                    className="w-1.5 bg-gray-700 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
                    title="Drag to resize"
                />

                {/* Center & Right */}
                <div className="flex-1 w-0 flex flex-row overflow-hidden min-w-0">
                    {/* Center Editor + Console */}
                    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                        <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                            </select>
                            <div className="flex items-center space-x-2">
                                <button title="Run (Ctrl/Cmd + ')" onClick={() => handleRunSubmit('run')} disabled={isRunning} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors text-sm">
                                    <FaPlay /> <span>{isRunning ? 'Running...' : "Run (Ctrl + ')"} </span>
                                </button>
                                <button title="Submit (Ctrl/Cmd + Enter)" onClick={() => handleRunSubmit('submit')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg flex items-center space-x-2 disabled:opacity-50 transition-colors text-sm">
                                    <FaPaperPlane /> <span>{isSubmitting ? 'Submitting...' : 'Submit (Ctrl + Enter)'}</span>
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 bg-gray-900 overflow-hidden min-w-0">
                            <div ref={editorWrapperRef} className="w-full h-full code-editor" tabIndex={0}>
                                <CodeEditor code={codeForEditor} setCode={handleCodeChange} language={language} />
                            </div>
                        </div>

                        <div onMouseDown={() => setIsResizingVertical(true)} className="h-1.5 bg-gray-800 border-t border-gray-700 cursor-row-resize hover:bg-blue-500 transition-colors flex-shrink-0"/>

                        <div style={{ height: `${consoleHeight}px` }} className="bg-gray-800 flex flex-col overflow-hidden flex-shrink-0 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-300 p-2 border-b border-gray-700 flex-shrink-0">Console Output</h3>
                            <div className="bg-gray-900 flex-1 p-4 overflow-auto">
                                <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">
                                    {output || 'Run or submit your code to see the output here...'}
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="w-80 flex flex-col bg-gray-800 border-l border-gray-700 flex-shrink-0 min-w-0">
                        <div className="flex border-b border-gray-700 flex-shrink-0">
                            <button onClick={() => handleRightPanelTabChange('leaderboard')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center space-x-2 ${rightPanelTab === 'leaderboard' ? 'bg-gray-750 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700'}`}><FaTrophy /> <span>Leaderboard</span></button>
                            <button onClick={() => handleRightPanelTabChange('chat')} className={`flex-1 py-2 px-4 text-sm font-medium flex items-center justify-center space-x-2 relative ${rightPanelTab === 'chat' ? 'bg-gray-750 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700'}`}>
                                <FaComments /> <span>Chat</span>
                                {unreadMessages > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadMessages}</span>}
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto min-w-0">
                            {rightPanelTab === 'leaderboard' && <Leaderboard leaderboard={leaderboard} contestStartTime={contest.startTime} />}
                            {rightPanelTab === 'chat' && <ChatBox socket={socket.current} user={user} roomId={roomId} messages={messages} setMessages={setMessages} />}
                        </div>
                    </div>
                </div>
            </main>

            {/* Final overlay when contest ended */}
            {showFinalOverlay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* dim background */}
                    <div className="absolute inset-0 bg-black/60" />

                    {/* confetti pieces */}
                    {confettiPieces.map(p => (
                        <div
                            key={p.id}
                            className="confetti-piece"
                            style={{
                                left: `${p.left}%`,
                                background: p.color,
                                width: `${p.size}px`,
                                height: `${p.size * 0.6}px`,
                                transform: `rotate(${p.rotate}deg)`,
                                animation: `confettiFall ${p.duration} linear ${p.delay}, confettiSwing ${0.8 + Math.random()}s ease-in-out ${p.delay} infinite`,
                                borderRadius: '2px',
                                opacity: 0.95,
                            }}
                        />
                    ))}

                    {/* modal */}
                    <div className="relative bg-gray-800 rounded-lg p-6 w-[min(920px,92%)] final-overlay shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-3">
                                <FaTrophy className="text-2xl text-yellow-400" />
                                <div>
                                    <h2 className="text-2xl font-bold">Contest Finished</h2>
                                    <div className="text-sm text-gray-300">Thanks for participating — here is the final leaderboard.</div>
                                </div>
                            </div>
                            <div>
                                <button onClick={() => { setShowFinalOverlay(false); }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded mr-2">Close</button>
                                <button onClick={() => navigate('/dashboard')} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white">Go Home</button>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-auto">
                            <Leaderboard leaderboard={leaderboard} contestStartTime={contest.startTime} finalView />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestRoom;
