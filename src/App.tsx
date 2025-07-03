import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Camera, FileText, Send, Pencil, Mic, Plus } from "lucide-react";
import "./App.css";
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
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // Prepare messages for the API
    const apiMessages = newMessages.map((msg) => {
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
    <div className="App">
      <div className="chat-window">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              {msg.image && (
                <img
                  src={msg.image}
                  alt="captured content"
                  className="captured-image"
                />
              )}
              {msg.sender === 'bot' ? (
                msg.isTyping ? (
                  <div className="loading-spinner"></div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                )
              ) : (
                msg.text
              )}
            </div>
          ))}
          <button
            className="new-chat-btn"
            onClick={() => {
              setMessages([]);
              setCapturedImage(null);
            }}
            disabled={loading}
            title="Start New Chat"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder={loading ? "Gemma is thinking..." : "Ask Gemma..."}
            disabled={loading}
          />
          <div className="action-buttons">
            <button
              className="icon-btn"
              onClick={handleSend}
              disabled={loading}
              title="Send"
            >
              <Send size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleActionClick("captureScreen")}
              disabled={loading}
              title="Capture screen"
            >
              <Camera size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleActionClick("getText")}
              disabled={loading}
              title="Read page text"
            >
              <FileText size={20} />
            </button>
            <button
              className={`icon-btn${isBrushActive ? ' active' : ''}`}
              onClick={activateSelection}
              disabled={loading}
              title={isBrushActive ? 'Deactivate brush selection tool' : 'Activate brush selection tool'}
              style={isBrushActive ? { background: '#4f8cff', color: '#fff' } : {}}
            >
              <Pencil size={20} />
            </button>
            <button
              className={`icon-btn${isRecording ? ' active' : ''}`}
              onClick={handleMicrophoneClick}
              disabled={loading}
              title={isRecording ? 'Stop recording' : 'Start recording'}
              style={isRecording ? { background: '#ff4f4f', color: '#fff' } : {}}
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