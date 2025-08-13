import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI("AIzaSyDGf0yS2u0bzTKP-qEK8dcCz79a-X-aMwA");

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

// Using a robust model like gemini-pro is a great choice.
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', safetySettings });

const cleanAiResponse = (text) => {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return cleaned;
};

export const generateQuestion = async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt cannot be empty.' });
    }

    const systemPrompt = `
        You are an expert creator of programming challenges. Your task is to generate a single coding problem based on a user's request.
        You MUST respond with ONLY a valid JSON object. Do not include any other text, explanation, or conversation outside of the JSON structure.
        The JSON object must have the following structure:
        {
          "title": "A concise, well-defined title for the problem",
          "description": "A clear, well-formatted description of the problem. Use markdown for code snippets (e.g., \`nums\`). Explain the input and output format clearly.",
          "testCases": [
            {
              "input": "A string representing the input for the test case, formatted as comma-separated JSON values. Example: [1,2,3], 5",
              "output": "A string representing the expected JSON output. Example: [0,1]"
            }
          ]
        }
        Generate at least 4 diverse test cases, including common examples and edge cases.
        Ensure the input and output strings in the test cases are valid JSON or primitives that can be parsed as JSON.
        
        User's Request: "${prompt}"
    `;

    try {
        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const text = response.text();

        const cleanedJson = cleanAiResponse(text);
        const parsedData = JSON.parse(cleanedJson);

        res.json(parsedData);

    } catch (error) {
        console.error("Error generating question from AI:", error);
        res.status(500).json({ message: "Failed to generate question from AI. Please try a different prompt." });
    }
};