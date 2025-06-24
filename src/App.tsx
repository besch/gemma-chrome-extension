import { useState, useEffect } from "react";
import { Camera, FileText, Send } from "lucide-react";
import "./App.css";

interface Message {
  text: string;
  sender: "user" | "bot";
  image?: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const listener = (message: any) => {
      setLoading(false); // Stop loading when any response comes back
      if (message.type === "captureResponse") {
        if (message.error) {
          console.error("Capture failed:", message.error);
          const errorMessage: Message = {
            text: `Error capturing screen: ${message.error}`,
            sender: "bot",
          };
          setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } else {
          setCapturedImage(message.dataUrl);
          const userMessage: Message = {
            text: "Attached an image.",
            sender: "user",
            image: message.dataUrl,
          };
          setMessages((prevMessages) => [...prevMessages, userMessage]);
        }
      } else if (message.type === "textResponse") {
        if (message.error) {
          const errorMessage: Message = {
            text: `Error reading page: ${message.error}`,
            sender: "bot",
          };
          setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } else if (message.text) {
          const prompt = `Please summarize the following text:\n\n${message.text}`;
          setInput(prompt);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleActionClick = (type: "captureScreen" | "getText") => {
    setLoading(true);
    chrome.runtime.sendMessage({ type });
  };

  const handleReadPage = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "getText" });
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
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error) {
      console.error("Failed to fetch from local LLM:", error);
      const errorMessage: Message = {
        text: "Error: Could not connect to the local model. Make sure it is running.",
        sender: "bot",
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setLoading(false);
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
              {msg.text}
            </div>
          ))}
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
            >
              <Send size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleActionClick("captureScreen")}
              disabled={loading}
            >
              <Camera size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => handleActionClick("getText")}
              disabled={loading}
            >
              <FileText size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
