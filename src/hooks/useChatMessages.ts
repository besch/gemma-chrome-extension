// src/hooks/useChatMessages.ts
import { useState, useEffect } from "react";
import { cropImage } from "../utils/imageUtils";

interface Message {
  text: string;
  sender: "user" | "bot";
  image?: string;
  isTyping?: boolean;
}

export const useChatMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
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
          // This part should ideally be handled by the component that triggers capture
          // For now, keeping it here for direct integration
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
          // This part should ideally be handled by the component that triggers getText
          // For now, keeping it here for direct integration
          const prompt = `Please summarize the following text:\n\n${message.text}`;
          // setInput(prompt); // Cannot set input from here, needs to be passed back
          const userMessage: Message = {
            text: prompt,
            sender: "user",
          };
          setMessages((prevMessages) => [...prevMessages, userMessage]);
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
          };
          setMessages((prev) => [...prev, userMessage]);
          // Add a loading message with spinner
          setMessages((prev) => [...prev, { text: "", sender: "bot", isTyping: true }]);

          // Prepare LLM payload
          const apiMessages = [
            {
              role: "user",
              content: [
                { type: "text", text: message.prompt || "Analyze the content of this image." },
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
          setMessages((prev) => {
            const newMessages = [...prev];
            // Remove the typing indicator
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].isTyping) {
              newMessages.pop();
            }
            return [...newMessages, botMessage];
          });
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
      } else if (message.type === 'audio-recorded') {
        setLoading(true);
        const audioDataUrl = message.data;

        const userMessage: Message = {
          text: "Transcribing audio...",
          sender: "user",
        };
        setMessages((prev) => [...prev, userMessage]);

        try {
          // Send audio to local STT server
          const sttResponse = await fetch("http://localhost:5000/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: audioDataUrl }),
          });

          if (!sttResponse.ok) {
            throw new Error(`STT server error! status: ${sttResponse.status}`);
          }

          const sttData = await sttResponse.json();
          const transcribedText = sttData.text;

          const transcribedMessage: Message = {
            text: `Transcribed: "${transcribedText}"\nSending to LLM...`,
            sender: "user",
          };
          setMessages((prev) => [...prev, transcribedMessage]);

          // Prepare LLM payload with transcribed text
          const apiMessages = [
            {
              role: "user",
              content: [
                { type: "text", text: `Analyze the following audio transcription: ${transcribedText}` },
              ],
            },
          ];

          const llmResponse = await fetch("http://localhost:1234/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemma-3.4b",
              messages: apiMessages,
              stream: false,
            }),
          });

          if (!llmResponse.ok) {
            throw new Error(`LLM server error! status: ${llmResponse.status}`);
          }

          const llmData = await llmResponse.json();
          const botMessage: Message = {
            text:
              llmData.choices[0]?.message?.content ||
              "Sorry, I had trouble getting a response from the LLM.",
            sender: "bot",
          };
          setMessages((prev) => {
            const newMessages = [...prev];
            // Remove the typing indicator
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].isTyping) {
              newMessages.pop();
            }
            return [...newMessages, botMessage];
          });

        } catch (error) {
          console.error("Failed to process audio:", error);
          const errorMessage: Message = {
            text: `Error processing audio: ${error instanceof Error ? error.message : String(error)}`,
            sender: "bot",
          };
          setMessages((prev) => {
            const newMessages = [...prev];
            // Remove the typing indicator
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].isTyping) {
              newMessages.pop();
            }
            return [...newMessages, errorMessage];
          });
        } finally {
          setLoading(false);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  return { messages, setMessages, loading, setLoading };
};