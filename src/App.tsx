import { useState, useEffect } from "react";
// Helper to crop a base64 PNG dataUrl to a given rectangle
async function cropImage(dataUrl: string, area: { left: number; top: number; width: number; height: number; devicePixelRatio: number }) {
  return new Promise<string>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = area.width * area.devicePixelRatio;
      canvas.height = area.height * area.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No canvas context');
      ctx.drawImage(
        img,
        area.left * area.devicePixelRatio,
        area.top * area.devicePixelRatio,
        area.width * area.devicePixelRatio,
        area.height * area.devicePixelRatio,
        0, 0,
        area.width * area.devicePixelRatio,
        area.height * area.devicePixelRatio
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
import { Camera, FileText, Send, Pencil } from "lucide-react";
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
    const listener = async (message: any) => {
      if (message.type === "captureResponse") {
        setLoading(false);
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
        setLoading(false);
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
      } else if (message.type === "cropAndAnalyze") {
        setLoading(true);
        // Crop the image to the selected area
        try {
          const cropped = await cropImage(message.dataUrl, message.area);
          // Send cropped image to LLM for analysis
          const userMessage: Message = {
            text: "Analyzing selected area...",
            sender: "user",
            image: cropped,
          };
          setMessages((prev) => [...prev, userMessage]);
          // Prepare LLM payload
          const apiMessages = [
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze the content of this image." },
                { type: "image_url", image_url: { url: cropped } },
              ],
            },
          ];
          const response = await fetch("http://localhost:1234/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemma-3.4b",
              messages: apiMessages,
              stream: false,
            }),
          });
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const data = await response.json();
          const botMessage: Message = {
            text:
              data.choices[0]?.message?.content ||
              "Sorry, I had trouble getting a response.",
            sender: "bot",
          };
          setMessages((prev) => [...prev, botMessage]);
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            { text: "Error analyzing selected area.", sender: "bot" },
          ]);
        } finally {
          setLoading(false);
        }
      } else if (message.type === "analyzeResult") {
        setLoading(false);
        if (message.error) {
          setMessages((prev) => [
            ...prev,
            { text: `Error: ${message.error}`, sender: "bot" },
          ]);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);
  // Activate selection tool in content script
  const [isBrushActive, setIsBrushActive] = useState(false);
  function activateSelection() {
    if (!isBrushActive) {
      chrome.runtime.sendMessage({ type: 'activateSelection' });
      setIsBrushActive(true);
    } else {
      chrome.runtime.sendMessage({ type: 'deactivateSelection' });
      setIsBrushActive(false);
    }
  }

  // Listen for brush tool deactivation from content script (optional, for robustness)
  useEffect(() => {
    const off = (message: any) => {
      if (message.type === 'deactivateBrushUI') setIsBrushActive(false);
    };
    chrome.runtime.onMessage.addListener(off);
    return () => chrome.runtime.onMessage.removeListener(off);
  }, []);
        <button
          className="icon-btn"
          onClick={activateSelection}
          disabled={loading}
          title="Select area on page"
        >
          🖌️
        </button>

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
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
