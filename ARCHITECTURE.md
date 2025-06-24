# Gemma Vision Agent - Architecture

This document outlines the architecture of the Gemma Vision Agent Chrome extension.

## 1. High-Level Overview

The project is a Manifest V3 Chrome extension that provides a chat interface in the browser's side panel. It allows a user to interact with a locally hosted Large Language Model (LLM) from LM Studio. The extension has agentic capabilities, enabling it to "see" the content of a web page via screenshots and "read" its text content to answer questions or perform tasks.

## 2. Core Components

The architecture is composed of three main parts:

### a. Side Panel UI (React App)

- **Framework**: Built with **React** and **TypeScript** for a modern, type-safe user interface.
- **Build Tool**: **Vite** is used for its fast development server and optimized build process, configured specifically for Chrome extension development.
- **UI/UX**: The interface is a chat window that displays the conversation history. It features a text input and action buttons with icons from the **`lucide-react`** library for a clean and responsive design.
- **Functionality**: It manages the application state (messages, loading status), sends user prompts to the LLM, and dispatches action requests (like "capture screen") to the background script.

### b. Background Script (`background.ts`)

- **Role**: This is the extension's central coordinator, running as a **Service Worker**. It is persistent (within browser limits) and manages communication between different parts of the extension.
- **Responsibilities**:
  1.  **Side Panel Management**: It initializes the side panel, setting it to open when the extension's toolbar icon is clicked.
  2.  **Action Handling**: It listens for messages from the side panel UI (`captureScreen`, `getText`).
  3.  **Chrome API Broker**: Upon receiving a request, it interacts with the appropriate Chrome APIs (`chrome.tabs`, `chrome.scripting`, `chrome.runtime`) to perform the action on the currently active tab. It handles all the logic for capturing the screen and injecting scripts to read page text.
  4.  **Error Handling**: It contains robust error handling and sends detailed error messages back to the UI if an action fails.

### c. Local LLM Server (External)

- **Technology**: The user is expected to run an LLM (e.g., Gemma) via **LM Studio**.
- **API**: LM Studio exposes an **OpenAI-compatible API** at `http://localhost:1234`.
- **Interaction**: The React UI communicates directly with this local server via standard `fetch` requests to the `/v1/chat/completions` endpoint, sending the conversation history and receiving the model's response.

## 3. Communication Flow & Data

The components communicate through two primary channels:

### a. Chat with LLM

1.  **User**: Types a message in the side panel's input field and hits "Send".
2.  **App.tsx**: The `handleSend` function updates the UI with the user's message, sets a `loading` state, and formats the entire message history into a payload.
3.  **Fetch API**: A `POST` request is sent to `http://localhost:1234/v1/chat/completions` with the payload.
4.  **LM Studio**: Processes the request and returns the LLM's response.
5.  **App.tsx**: The response is received, the `loading` state is cleared, and the UI is updated with the bot's message.

### b. Agentic Actions (Capture/Read Page)

1.  **User**: Clicks the "Capture" or "Read Page" icon in the side panel.
2.  **App.tsx**: An action message (e.g., `{type: 'captureScreen'}`) is sent to the background script via `chrome.runtime.sendMessage`. The `loading` state is set.
3.  **background.ts**: The `onMessage` listener catches the request. It uses `chrome.tabs.query` to find the active tab.
4.  **Chrome API**: The background script calls the relevant Chrome API (`captureVisibleTab` or `scripting.executeScript`).
5.  **background.ts**: When the API call completes, it sends the result (or an error) back to the side panel via `chrome.runtime.sendMessage`.
6.  **App.tsx**: The `useEffect` message listener receives the response, clears the `loading` state, and updates the UI with the result (e.g., showing a captured image or populating the input with page text).

## 4. What We've Done: Project History

1.  **Initialization**: Set up a Vite + React + TypeScript project from scratch.
2.  **Manifest & Build Config**: Created the `manifest.json` for a side panel extension and configured `vite.config.ts` to build the necessary HTML, JS, and background scripts.
3.  **Basic UI**: Built the core chat interface with React components and CSS.
4.  **LLM Integration**: Implemented `fetch` logic to connect the UI to the local LM Studio server.
5.  **Agent Capabilities**:
    - Added a "Capture Screen" feature using `chrome.tabs.captureVisibleTab`.
    - Added a "Read Page" feature, initially with a `content_script` and later refactored to use the more robust `chrome.scripting.executeScript`.
6.  **Debugging & Refinement**:
    - Solved multiple build and configuration issues related to file paths and module resolution (`__dirname`).
    - Fixed critical runtime errors, including permission errors in the manifest and race conditions that caused the UI to freeze.
    - Corrected the LLM payload structure to support conversational history and prevent role alternation errors.
7.  **UI Polish**: Replaced text buttons with icons from `lucide-react` and completely refactored the CSS to be responsive and visually appealing, ensuring elements don't overlap in a narrow side panel.
