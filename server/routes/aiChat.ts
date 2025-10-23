import { Router, Request, Response } from 'express';
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY as string,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

// System prompt for general purpose AI assistant
const SYSTEM_PROMPT = `You are a helpful, knowledgeable, and friendly AI assistant. Your purpose is to assist users with a wide variety of questions and tasks.

Key characteristics:
- Be helpful, accurate, and concise in your responses
- Provide clear explanations and step-by-step guidance when needed
- Admit when you don't know something rather than making up information
- Be respectful and professional in all interactions
- Adapt your communication style to match the user's needs
- Ask clarifying questions when the user's intent is unclear
- Provide relevant examples and practical advice when appropriate
- Stay objective and unbiased in your responses
- Break down complex topics into easy-to-understand language

You can help with:
- General knowledge questions
- Problem-solving and brainstorming
- Explanations of concepts and topics
- Writing and editing assistance
- Code and technical questions
- Creative tasks and ideas
- Learning and educational support
- Practical advice and recommendations

Always prioritize being helpful while maintaining accuracy and honesty.`;

// POST /api/chat
router.post('/', async (req: Request, res: Response) => {
  try {
    const { messages, model = 'claude' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (model === 'gemini') {
      // Use Gemini
      const geminiModel = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: SYSTEM_PROMPT
      });

      // Convert messages to Gemini format
      const chat = geminiModel.startChat({
        history: messages.slice(0, -1).map((msg: any) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;

      res.json({
        content: [{ text: response.text() }],
        model: 'gemini-pro'
      });
    } else {
      // Use Claude (default)
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 20000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: messages
      });

      res.json({
        ...msg,
        model: 'claude-sonnet-4'
      });
    }
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
