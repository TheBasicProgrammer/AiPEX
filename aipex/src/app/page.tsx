'use client';
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// Define types
interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ChatHistoryItem {
  role: 'user' | 'model';
  parts: Array<{text: string}>;
}

function App() {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      content: "Welcome to AiPEX! I'm your APEC Schools Marikina Heights assistant. How can I help you today?" 
    }
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Reset error state
    setError(null);
    
    // Add user message to chat
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          history: chatHistory
        }),
      });
      
      // Check if response is OK before parsing as JSON
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}...`);
      }
      
      // Parse response as JSON
      const data = await response.json();
      
      // Add bot response to chat
      if (data.response) {
        setMessages(prev => [...prev, { role: 'model', content: data.response }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'model', content: `Sorry, I encountered an error: ${data.error}` }]);
      }
      
      // Update chat history
      if (data.history) {
        setChatHistory(data.history);
      }
      
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      setMessages(prev => [
        ...prev, 
        { role: 'model', content: `Sorry, I'm having trouble connecting right now. Error details: ${errorMessage}` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <div className="container max-w-4xl bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center">
          <div className="mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-xl">AiPEX</h1>
            <p className="text-sm opacity-90">APEC Schools Marikina Heights Assistant</p>
          </div>
        </div>
        
        {/* Chat Container */}
        <div className="flex flex-col h-[70vh]">
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 mb-4 max-w-[75%] ${
                  msg.role === 'user'
                    ? 'ml-auto bg-blue-100 rounded-t-lg rounded-l-lg'
                    : 'bg-gray-100 rounded-t-lg rounded-r-lg'
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="prose max-w-none" {...props} />
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            ))}
            {isLoading && (
              <div className="bg-gray-100 p-3 mb-4 max-w-[75%] rounded-t-lg rounded-r-lg inline-flex">
                <span className="animate-pulse mr-1">•</span>
                <span className="animate-pulse mr-1 animate-delay-200">•</span>
                <span className="animate-pulse animate-delay-400">•</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="border-t p-4">
            <form onSubmit={handleSubmit} className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message here..."
                className="flex-grow border border-gray-300 rounded-l-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`${
                  isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } text-white rounded-r-lg px-6 flex items-center justify-center`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Wait</span>
                ) : (
                  <>
                    <span>Send</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center p-3 text-gray-500 text-sm border-t">
          Powered by Gemini AI • APEC Schools Marikina Heights © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

export default App;