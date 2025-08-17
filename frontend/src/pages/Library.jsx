import { useState, useEffect } from 'react';
import API from '../api';
import toast from 'react-hot-toast';

const Library = () => {
    const [publicQuestions, setPublicQuestions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPublicQuestions = async () => {
            setIsLoading(true);
            try {
                const { data } = await API.get('/contest/public-questions');
                setPublicQuestions(data);
            } catch (error) {
                toast.error("Could not load the public question library.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchPublicQuestions();
    }, []);

    const parseDescription = (desc) => {
        if (!desc) return '';
        const codeBlocks = [];
        let processedText = desc.replace(/```([\s\S]*?)```/g, (match, code) => {
            const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const formattedBlock = `<pre class="bg-gray-900 p-3 rounded-md text-sm font-mono my-4 overflow-x-auto">${escapedCode.trim()}</pre>`;
            codeBlocks.push(formattedBlock);
            return `__CODEBLOCK_${codeBlocks.length - 1}__`;
        });
        processedText = processedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-700 text-sm rounded px-1 py-0.5 font-mono">$1</code>');
        processedText = processedText
            .split('\n')
            .map(line => line.trim() === '' ? '<br/>' : line)
            .join('\n')
            .replace(/(<br\/>){2,}/g, '<br/>')
            .replace(/\n/g, '<br/>');
        processedText = processedText.replace(/__CODEBLOCK_(\d+)__/g, (match, index) => {
            return codeBlocks[parseInt(index, 10)];
        });
        return processedText;
    };


    if (isLoading) {
        return <div className="fixed inset-0 bg-gray-900 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-500"></div></div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-center text-teal-400 mb-8">Public Question Library</h1>
            <div className="space-y-6">
                {publicQuestions.length > 0 ? publicQuestions.map((q, index) => (
                    <div key={q._id || index} className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                        <h2 className="text-2xl font-bold text-white mb-3">{q.title}</h2>
                        <div
                            className="text-gray-300/90 leading-relaxed space-y-4"
                            dangerouslySetInnerHTML={{ __html: parseDescription(q.description) }}
                        />
                        {q.testCases && q.testCases[0] && (
                             <div className="mt-6">
                                <h3 className="text-base font-semibold text-gray-400 mb-2">Example:</h3>
                                <div className="bg-gray-900 rounded-md p-3 text-sm font-mono space-y-1">
                                    <div><span className="text-gray-500">Input: </span>{q.testCases[0].input}</div>
                                    <div><span className="text-gray-500">Output: </span>{q.testCases[0].output}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="text-center py-10 bg-gray-800 rounded-lg">
                        <p className="text-gray-400 text-lg">No public questions available yet.</p>
                        <p className="text-gray-500">Create a contest to contribute to the library!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Library;