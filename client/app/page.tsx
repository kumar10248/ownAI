'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'claude' | 'gemini'>('claude');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [copyToastMessage, setCopyToastMessage] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: input,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create new AbortController for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('https://own-ai-kappa-ten.vercel.app/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.content[0].text,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ Request was cancelled by user.',
            timestamp: new Date()
          },
        ]);
      } else {
        console.error('Error:', error);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '❌ Sorry, I encountered an error. Please make sure the backend server is running on port 3000.',
            timestamp: new Date()
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
      inputRef.current?.focus();
    }
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id.startsWith('msg-')) {
        setCopiedMessage(parseInt(id.split('-')[1]));
        setTimeout(() => setCopiedMessage(null), 2000);
        setCopyToastMessage('Message copied!');
      } else {
        setCopiedCode(id);
        setTimeout(() => setCopiedCode(null), 2000);
        setCopyToastMessage('Code copied!');
      }
      // Show toast
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyToastMessage('Failed to copy');
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2000);
    }
  };

  const startEditing = (index: number, content: string) => {
    setEditingIndex(index);
    setEditContent(content);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditContent('');
  };

  const saveEdit = async (index: number) => {
    if (!editContent.trim()) return;

    // Update the message
    const updatedMessages = [...messages];
    updatedMessages[index] = {
      ...updatedMessages[index],
      content: editContent,
    };

    // Remove all messages after the edited one
    const messagesToKeep = updatedMessages.slice(0, index + 1);
    setMessages(messagesToKeep);
    setEditingIndex(null);
    setEditContent('');
    setIsLoading(true);

    // Resend to get new response
    try {
      const response = await fetch('https://own-ai-kappa-ten.vercel.app/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToKeep.map(m => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.content[0].text,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedPrompts = [
    { icon: '🧮', text: 'What is the value of 6+9?' },
    { icon: '⚛️', text: 'Explain quantum computing simply' },
    { icon: '🐍', text: 'Write a Python sorting algorithm' },
    { icon: '💡', text: 'Help me brainstorm a startup idea' },
  ];

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-400 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Copy Toast Notification */}
      {showCopyToast && (
        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in px-4">
          <div className="bg-black/90 backdrop-blur-md border border-amber-500/50 rounded-xl px-4 sm:px-6 py-2 sm:py-3 shadow-2xl flex items-center gap-2 sm:gap-3">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-white font-medium text-sm sm:text-base">{copyToastMessage}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col w-full max-w-6xl mx-auto relative z-10 h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-6 backdrop-blur-xl bg-white/5 border-b border-amber-500/20 shadow-lg">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                <span className="text-black text-xl sm:text-2xl font-bold">AI</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-green-400 rounded-full border-2 border-black animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white">
                OwnAI Chat
              </h1>
              <p className="text-xs sm:text-sm text-amber-200 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                {selectedModel === 'claude' ? 'Claude AI' : 'Gemini AI'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            {/* Model Selector */}
            <div className="flex gap-1 sm:gap-2 bg-white/5 rounded-xl p-1 border border-amber-500/30">
              <button
                onClick={() => setSelectedModel('claude')}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  selectedModel === 'claude'
                    ? 'bg-amber-500 text-black'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Claude
              </button>
              <button
                onClick={() => setSelectedModel('gemini')}
                className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  selectedModel === 'gemini'
                    ? 'bg-amber-500 text-black'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Gemini
              </button>
            </div>
            {messages.length > 0 && (
              <>
                <span className="text-xs sm:text-sm text-amber-200 hidden md:inline">
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={clearChat}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white hover:text-amber-400 bg-white/5 hover:bg-white/10 rounded-xl transition-all backdrop-blur-sm border border-amber-500/30 hover:border-amber-500/50"
                >
                  <span className="hidden sm:inline">🗑️ Clear</span>
                  <span className="sm:hidden">🗑️</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-amber-500/50 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 sm:space-y-8 py-8 sm:py-12 animate-fade-in px-4">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-2xl animate-float">
                  <span className="text-black text-4xl sm:text-5xl font-bold">AI</span>
                </div>
                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-amber-400 via-amber-500 to-amber-600 blur-2xl opacity-50 animate-pulse"></div>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                <h2 className="text-2xl sm:text-4xl font-bold text-white">
                  Welcome to OwnAI Chat
                </h2>
                <p className="text-base sm:text-lg text-amber-200 max-w-md px-4">
                  Your intelligent AI assistant powered by {selectedModel === 'claude' ? 'Claude' : 'Gemini'}. Ask me anything!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl w-full mt-6 sm:mt-8 px-4">
                {suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(prompt.text)}
                    className="group p-3 sm:p-4 text-left bg-white/5 backdrop-blur-md border border-amber-500/30 rounded-2xl hover:bg-amber-500/10 hover:border-amber-500/50 transition-all transform hover:scale-105 hover:shadow-xl"
                  >
                    <span className="text-xl sm:text-2xl mb-2 block">{prompt.icon}</span>
                    <span className="text-xs sm:text-sm text-white/80 group-hover:text-white">
                      {prompt.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex gap-2 sm:gap-4 animate-slide-in ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div className={`shrink-0 ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  {message.role === 'assistant' ? (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                      <span className="text-black text-base sm:text-lg font-bold">AI</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                      <span className="text-black text-base sm:text-lg">👤</span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[75%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {editingIndex === idx && message.role === 'user' ? (
                    // Edit mode
                    <div className="w-full">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 backdrop-blur-md border border-amber-500/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white text-sm sm:text-base resize-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          onClick={cancelEditing}
                          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(idx)}
                          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-amber-500 hover:bg-amber-600 rounded-lg transition-all text-black font-medium"
                        >
                          Save & Resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-lg backdrop-blur-md relative group ${
                          message.role === 'user'
                            ? 'bg-linear-to-br from-green-500 to-green-600 text-white'
                            : 'bg-white/10 border border-amber-500/30 text-white'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-invert prose-amber max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                              components={{
                                h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 mt-3 sm:mt-4 text-amber-200" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-lg sm:text-xl font-bold mb-2 mt-2 sm:mt-3 text-amber-200" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-base sm:text-lg font-semibold mb-2 mt-2 text-amber-300" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-2 sm:mb-3 leading-relaxed text-sm sm:text-base text-white" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 sm:mb-3 space-y-1 text-sm sm:text-base text-white" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 sm:mb-3 space-y-1 text-sm sm:text-base text-white" {...props} />,
                                li: ({ node, ...props }) => <li className="ml-2 text-white" {...props} />,
                                code: ({ node, inline, className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  // Extract text content properly from children
                                  const getTextContent = (content: any): string => {
                                    if (typeof content === 'string') return content;
                                    if (Array.isArray(content)) {
                                      return content.map(getTextContent).join('');
                                    }
                                    if (content?.props?.children) {
                                      return getTextContent(content.props.children);
                                    }
                                    return '';
                                  };
                                  
                                  const codeString = getTextContent(children).replace(/\n$/, '');
                                  const codeId = `code-${idx}-${Math.random()}`;
                                  
                                  return !inline ? (
                                    <div className="relative group/code my-3">
                                      <button
                                        onClick={() => copyToClipboard(codeString, codeId)}
                                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-lg transition-all opacity-0 group-hover/code:opacity-100 z-10"
                                        title="Copy code"
                                      >
                                        {copiedCode === codeId ? (
                                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                          </svg>
                                        )}
                                      </button>
                                      <pre className="bg-black/60 p-4 rounded-lg overflow-x-auto">
                                        <code className={`${className} text-sm font-mono`} {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    </div>
                                  ) : (
                                    <code className="bg-black/40 text-amber-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre: ({ node, ...props }) => <div {...(props as any)} />,
                                table: ({ node, ...props }) => <table className="border-collapse border border-amber-500/30 my-3 w-full" {...props} />,
                                th: ({ node, ...props }) => <th className="border border-amber-500/30 px-3 py-2 bg-amber-500/20 font-semibold text-amber-200" {...props} />,
                                td: ({ node, ...props }) => <td className="border border-amber-500/30 px-3 py-2 text-white" {...props} />,
                                blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-amber-500 pl-4 italic my-3 text-amber-100" {...props} />,
                                a: ({ node, ...props }) => <a className="text-amber-400 hover:text-amber-300 underline" {...props} />,
                                strong: ({ node, ...props }) => <strong className="font-bold text-amber-200" {...props} />,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap wrap-break-word">
                            {message.content}
                          </p>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 sm:gap-2 px-2">
                        <span className="text-[10px] sm:text-xs text-amber-300">
                          {formatTime(message.timestamp)}
                        </span>
                        <div className="flex gap-0.5 sm:gap-1">
                          <button
                            onClick={() => copyToClipboard(message.content, `msg-${idx}`)}
                            className="p-1 sm:p-1.5 hover:bg-white/10 rounded-lg transition-all group/btn"
                            title="Copy message"
                          >
                            {copiedMessage === idx ? (
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400/70 group-hover/btn:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          {message.role === 'user' && (
                            <button
                              onClick={() => startEditing(idx, message.content)}
                              className="p-1 sm:p-1.5 hover:bg-white/10 rounded-lg transition-all group/btn"
                              title="Edit message"
                            >
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400/70 group-hover/btn:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-2 sm:gap-4 animate-slide-in">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                <span className="text-black text-base sm:text-lg font-bold">AI</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-amber-500/30 rounded-2xl px-3 sm:px-5 py-2 sm:py-3 shadow-lg">
                <div className="flex gap-2 items-center">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-amber-300 ml-2">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-6 backdrop-blur-xl bg-white/5 border-t border-amber-500/20">
          <form onSubmit={sendMessage} className="flex gap-2 sm:gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Shift+Enter for new line)"
                disabled={isLoading}
                rows={1}
                className="w-full px-3 sm:px-5 py-3 sm:py-4 bg-white/5 backdrop-blur-md border border-amber-500/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 text-white placeholder-amber-300/50 resize-none transition-all text-sm sm:text-base"
                style={{ maxHeight: '150px', minHeight: '48px' }}
              />
            </div>
            <button
              type={isLoading ? "button" : "submit"}
              onClick={isLoading ? stopGeneration : undefined}
              disabled={!isLoading && !input.trim()}
              className={`px-4 sm:px-8 py-3 sm:py-4 rounded-2xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl flex items-center gap-1 sm:gap-2 text-sm sm:text-base ${
                isLoading 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-linear-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  <span className="hidden sm:inline">Stop</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Send</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
          <p className="text-[10px] sm:text-xs text-amber-300 mt-2 sm:mt-3 text-center">
            Press <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/5 rounded border border-amber-500/30 text-[10px] sm:text-xs">Enter</kbd> to send • <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/5 rounded border border-amber-500/30 text-[10px] sm:text-xs">Shift + Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  );
}