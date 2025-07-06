import { useState, useEffect, useRef } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Camera, FileText, Send, Pencil, Mic, Plus } from "lucide-react";

import { useChatMessages } from "./hooks/useChatMessages";

interface Message {
  text: string;
  sender: "user" | "bot";
  image?: string;
  isTyping?: boolean;
}

function App() {
  const { messages, setMessages, loading, setLoading } = useChatMessages();
  const [input, setInput] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Activate selection tool in content script
  function activateSelection() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        const newBrushState = !isBrushActive;
        console.log(`[Gemma] Sending ${newBrushState ? 'activateSelection' : 'deactivateSelection'} to tab ${tabs[0].id}`);
        chrome.tabs.sendMessage(tabs[0].id, {
          type: newBrushState ? 'activateSelection' : 'deactivateSelection'
        });
        setIsBrushActive(newBrushState);
      } else {
        console.error('[Gemma] Could not find active tab to send message to.');
      }
    });
  }

  // Listen for brush tool deactivation from content script (optional, for robustness)
  // This useEffect should ideally be in a separate hook if it grows more complex
  useEffect(() => {
    const off = (message: any) => {
      if (message.type === 'deactivateBrushUI') setIsBrushActive(false);
    };
    chrome.runtime.onMessage.addListener(off);
    return () => chrome.runtime.onMessage.removeListener(off);
  }, []);

  const handleActionClick = (type: "captureScreen" | "getText") => {
    setLoading(true);
    chrome.runtime.sendMessage({ type });
  };

  const handleSend = async () => {
    if ((!input.trim() && !capturedImage) || loading) return;

    setLoading(true);
    // Add user message to UI
    const userMessage: Message = {
      text: input,
      sender: "user",
      image: capturedImage || undefined,
    };
    // Show typing indicator
    const newMessages: Message[] = [...messages, userMessage, { text: '', sender: 'bot', isTyping: true }];
    setMessages(newMessages);

    // Prepare messages for the API, filtering out the typing indicator
    const apiMessages = newMessages
      .filter(msg => !msg.isTyping)
      .map((msg) => {
        let content;
        if (msg.image) {
          content = [
            { type: "text", text: msg.text },
            { type: "image_url", image_url: { url: msg.image } },
          ];
        } else {
          content = msg.text;
        }

        return {
          role: msg.sender === "user" ? "user" : "assistant",
          content: content,
        };
      });

    setInput("");
    setCapturedImage(null);

    try {
      const response = await fetch(
        "http://localhost:1234/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemma-3.4b", // Or whatever model you have loaded
            messages: apiMessages,
            stream: false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const botMessage: Message = {
        text:
          data.choices[0]?.message?.content ||
          "Sorry, I had trouble getting a response.",
        sender: "bot",
      };
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        // Remove the typing indicator
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].isTyping) {
          newMessages.pop();
        }
        return [...newMessages, botMessage];
      });
    } catch (error) {
      console.error("Failed to fetch from local LLM:", error);
      const errorMessage: Message = {
        text: "Error: Could not connect to the local model. Make sure it is running.",
        sender: "bot",
      };
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        // Remove the typing indicator
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].isTyping) {
          newMessages.pop();
        }
        return [...newMessages, errorMessage];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMicrophoneClick = async () => {
    if (isRecording) {
      chrome.runtime.sendMessage({ type: 'stop-recording' });
      setIsRecording(false);
    } else {
      // Check for microphone permission first
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'granted') {
        chrome.runtime.sendMessage({ type: 'start-recording' });
        setIsRecording(true);
      } else if (permissionStatus.state === 'prompt') {
        // Open a new window to request permission
        chrome.runtime.sendMessage({ type: 'open-microphone-access' });
      } else if (permissionStatus.state === 'denied') {
        alert('Microphone access denied. Please enable it in your browser settings.');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-800 text-gray-100">
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-2 p-2 scrollbar-thumb-gray-700 scrollbar-track-gray-800 scrollbar-thin">
          {messages.map((msg, index) => (
            <div key={index} className={`flex flex-col p-3 rounded-lg break-words ${msg.sender === 'user' ? 'ml-auto bg-blue-600 text-white rounded-br-none' : 'mr-auto bg-gray-700 text-gray-100 rounded-bl-none'}`}>
              {msg.image && (
                <img
                  src={msg.image}
                  alt="captured content"
                  className="max-w-full h-auto rounded-md mb-2"
                />
              )}
              {msg.sender === 'bot' ? (
                msg.isTyping ? (
                  <div className="flex space-x-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-300"></span>
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                )
              ) : (
                msg.text
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <button
          className="absolute top-4 right-4 p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white shadow-lg transition-colors duration-200 z-10"
          onClick={() => {
            setMessages([]);
            setCapturedImage(null);
          }}
          disabled={loading}
          title="Start New Chat"
        >
          <Plus size={20} />
        </button>
        <div className="flex p-4 border-t border-gray-700 bg-gray-800 items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={loading ? "Gemma is thinking..." : "Ask Gemma..."}
            disabled={loading}
            className="flex-1 p-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <div className="flex space-x-2">
            <button
              className="p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-blue-600 hover:text-white transition-colors duration-200 flex items-center justify-center"
              onClick={handleSend}
              disabled={loading}
              title="Send"
            >
              <Send size={20} />
            </button>
            <button
              className="p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-blue-600 hover:text-white transition-colors duration-200 flex items-center justify-center"
              onClick={() => handleActionClick("captureScreen")}
              disabled={loading}
              title="Capture screen"
            >
              <Camera size={20} />
            </button>
            <button
              className="p-2 rounded-md border border-gray-600 text-gray-400 hover:bg-blue-600 hover:text-white transition-colors duration-200 flex items-center justify-center"
              onClick={() => handleActionClick("getText")}
              disabled={loading}
              title="Read page text"
            >
              <FileText size={20} />
            </button>
            <button
              className={`p-2 rounded-md border transition-colors duration-200 flex items-center justify-center ${isBrushActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-400 border-gray-600 hover:bg-blue-600 hover:text-white'}`}
              onClick={activateSelection}
              disabled={loading}
              title={isBrushActive ? 'Deactivate brush selection tool' : 'Activate brush selection tool'}
            >
              <Pencil size={20} />
            </button>
            <button
              className={`p-2 rounded-md border transition-colors duration-200 flex items-center justify-center ${isRecording ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-400 border-gray-600 hover:bg-blue-600 hover:text-white'}`}
              onClick={handleMicrophoneClick}
              disabled={loading}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <Mic size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;