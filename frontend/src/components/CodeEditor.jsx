import Editor from '@monaco-editor/react';

const CodeEditor = ({ code, setCode, language }) => {
  return (
    <div className="h-full border border-gray-700 rounded-lg overflow-hidden">
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={code}
        onChange={(value) => setCode(value || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  );
};

export default CodeEditor;