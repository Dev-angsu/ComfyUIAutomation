import React, { useState, useRef, useEffect } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export function ChatApp() {
  const [messages, setMessages] = useLocalStorage<Message[]>("dnd_chat_history", []);
  const [apiUrl, setApiUrl] = useLocalStorage<string>("dnd_lmstudio_url", "http://localhost:1234/v1/chat/completions");
  const [modelId, setModelId] = useLocalStorage<string>("dnd_lmstudio_model", "local-model");
  const [storyType, setStoryType] = useLocalStorage<string>("dnd_story_type", "Dark Fantasy 5e");

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear the chat history?")) {
      setMessages([]);
    }
  };

  const handleDownloadHistory = () => {
    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `dnd_history_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const importedMessages = JSON.parse(content);
        if (Array.isArray(importedMessages)) {
          setMessages(importedMessages);
        } else {
          alert("Invalid chat history format.");
        }
      } catch (err) {
        alert("Error parsing JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    event.target.value = "";
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const systemPrompt = `You are an immersive, creative, and engaging Dungeons and Dragons narrator. The current setting and tone is: ${storyType}. Describe the world, the NPCs, and the outcomes of the player's actions vividly. Keep responses reasonably concise but highly atmospheric.`;

    // Construct the payload for LM Studio (OpenAI compatible)
    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...newMessages
      ],
      temperature: 0.7,
      stream: true // Enable streaming
    };

    try {
      // Use the backend as a proxy to bypass CORS issues
      const proxyUrl = `http://${window.location.hostname}:8000/api/chat/proxy`;
      
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_url: apiUrl,
          payload: payload
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || response.statusText);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      
      // Add an initial empty assistant message that we will update
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            
            // SSE format is "data: {...}"
            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.replace("data: ", "");
                const jsonData = JSON.parse(jsonStr);
                const content = jsonData.choices?.[0]?.delta?.content || "";
                if (content) {
                  assistantContent += content;
                  // Update the last message in the list
                  setMessages(prev => {
                    const updated = [...prev];
                    if (updated.length > 0) {
                      updated[updated.length - 1] = { 
                        role: "assistant", 
                        content: assistantContent 
                      };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                console.warn("Error parsing stream chunk", e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Chat API Error:", error);
      setMessages([...newMessages, { role: "assistant", content: `**Error communicating with LM Studio (via Proxy):** ${error.message}\n\n1. Ensure LM Studio is running on the target machine.\n2. Verify the URL is correct and accessible from the machine running the Backend.\n3. Check LM Studio's logs for incoming requests.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round" className="text-indigo-400">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h2 className="text-lg font-semibold text-zinc-100">Stories</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImportHistory}
            className="hidden"
            id="import-chat-history"
          />
          <button
            onClick={() => document.getElementById('import-chat-history')?.click()}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
            title="Import History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Import
          </button>
          <button
            onClick={handleDownloadHistory}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-2"
            title="Download History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </button>
          <button
            onClick={handleClearHistory}
            className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            title="Clear History"
          >
            Clear
          </button>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg transition-colors ${isSettingsOpen ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div className="bg-zinc-800/80 border-b border-zinc-700 p-4 shrink-0 flex flex-col gap-4 text-sm z-10 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 font-medium">LM Studio API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                placeholder="http://localhost:1234/v1/chat/completions"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 font-medium">Model ID</label>
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                placeholder="local-model"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 font-medium">Story Setting/Tone</label>
              <input
                type="text"
                value={storyType}
                onChange={(e) => setStoryType(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                placeholder="e.g. Dark Fantasy 5e"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Make sure CORS is enabled in LM Studio. These settings are saved locally in your browser.
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLineJoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p>Your adventure awaits. Speak to the Narrator to begin.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] rounded-2xl px-5 py-3.5 leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md' 
                  : 'bg-zinc-800 text-zinc-200 rounded-tl-sm border border-zinc-700 shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <div className="relative flex items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="What do you do?"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-4 pr-14 py-3.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 resize-none overflow-hidden"
            rows={1}
            style={{ minHeight: '54px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLineJoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[10px] text-zinc-600 font-medium">Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
