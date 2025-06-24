import { useState, useEffect } from "react";
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

  useEffect(() => {
    const listener = (message: any) => {
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
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleCapture = () => {
    chrome.runtime.sendMessage({ type: "captureScreen" });
  };

  const handleReadPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "getText" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            const errorMessage: Message = {
              text: `Error reading page: ${chrome.runtime.lastError.message}`,
              sender: "bot",
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
          } else if (response && response.text) {
            const prompt = `Please summarize the following text:\n\n${response.text}`;
            setInput(prompt);
            // Optionally, send it to the LLM automatically
            // handleSend();
          }
        });
      }
    });
  };

  const handleSend = async () => {
    if (!input.trim() && !capturedImage) return;

    const userMessage: Message = {
      text: input,
      sender: "user",
      image: capturedImage || undefined,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    const llmInput = capturedImage
      ? [
          { type: "text", text: input },
          { type: "image_url", image_url: { url: capturedImage } },
        ]
      : [{ role: "user", content: input }];

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
            messages: [{ role: "user", content: llmInput }],
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
            placeholder="Ask Gemma..."
          />
          <button onClick={handleSend}>Send</button>
          <button id="capture-btn" onClick={handleCapture}>
            Capture
          </button>
          <button id="read-page-btn" onClick={handleReadPage}>
            Read Page
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
