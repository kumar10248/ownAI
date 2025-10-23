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

      // Convert messages to Gemini format with file support
      const history = messages.slice(0, -1).map((msg: any) => {
        const parts: any[] = [];
        
        // Add file content if present
        if (msg.files && msg.files.length > 0) {
          msg.files.forEach((file: any) => {
            if (file.type.startsWith('image/')) {
              // Extract base64 data
              const base64Data = file.content.split(',')[1];
              const mimeType = file.content.split(';')[0].split(':')[1];
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              });
            } else {
              // For non-image files, include file info in text
              parts.push({ 
                text: `[File: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)]` 
              });
            }
          });
        }
        
        // Add text content
        parts.push({ text: msg.content });
        
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: parts,
        };
      });

      const chat = geminiModel.startChat({ history });

      const lastMessage = messages[messages.length - 1];
      const lastParts: any[] = [];
      
      // Add files from last message
      if (lastMessage.files && lastMessage.files.length > 0) {
        lastMessage.files.forEach((file: any) => {
          if (file.type.startsWith('image/')) {
            const base64Data = file.content.split(',')[1];
            const mimeType = file.content.split(';')[0].split(':')[1];
            lastParts.push({
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            });
          } else {
            lastParts.push({ 
              text: `[File: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)]` 
            });
          }
        });
      }
      
      lastParts.push({ text: lastMessage.content });
      
      const result = await chat.sendMessage(lastParts);
      const response = result.response;

      res.json({
        content: [{ text: response.text() }],
        model: 'gemini-2.5-flash'
      });
    } else {
      // Use Claude (default) - supports vision
      const formattedMessages = messages.map((msg: any) => {
        const content: any[] = [];
        
        // Add files if present
        if (msg.files && msg.files.length > 0) {
          msg.files.forEach((file: any) => {
            if (file.type.startsWith('image/')) {
              // Claude supports images
              const base64Data = file.content.split(',')[1];
              const mediaType = file.type;
              content.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                }
              });
            } else {
              // For non-image files, add as text
              content.push({
                type: "text",
                text: `[Attached file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)]`
              });
            }
          });
        }
        
        // Add text content
        content.push({
          type: "text",
          text: msg.content
        });
        
        return {
          role: msg.role,
          content: content
        };
      });

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 20000,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: formattedMessages
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
