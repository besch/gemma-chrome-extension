# Gemma Vision Agent - Architecture

This document outlines the architecture of the Gemma Vision Agent Chrome extension.

## 1. High-Level Overview

The project is a Manifest V3 Chrome extension that provides a chat interface in the browser's side panel. It allows a user to interact with a locally hosted Large Language Model (LLM) from LM Studio. The extension has agentic capabilities, enabling it to "see" the content of a web page via screenshots, "read" its text content, and analyze specific user-selected regions.

## 2. Core Components

The architecture is composed of four main parts:

### a. Side Panel UI (React App)

- **Framework**: Built with **React** and **TypeScript** for a modern, type-safe user interface.
- **Build Tool**: **Vite** is used for its fast development server and optimized build process, configured specifically for Chrome extension development.
- **UI/UX**: The interface is a chat window with a sophisticated dark theme. It displays the conversation history, rendering the LLM's responses from Markdown to formatted HTML using **`react-markdown`**. Action buttons use icons from **`lucide-react`**.
- **Functionality**: It manages the application state (messages, loading status), sends user prompts to the LLM, and dispatches action requests (like "capture screen" or "activate brush") to other parts of the extension. It also handles image cropping and final communication with the LLM.

### b. Background Script (`background.ts`)

- **Role**: This is the extension's central coordinator, running as a **Service Worker**. It is persistent (within browser limits) and manages communication between different parts of the extension.
- **Responsibilities**:
  1.  **Side Panel Management**: It initializes the side panel, setting it to open when the extension's toolbar icon is clicked.
  2.  **Action Handling**: It listens for messages from the side panel UI (`captureScreen`, `getText`) and the content script (`analyzeArea`).
  3.  **Chrome API Broker**: It is the primary interface with the Chrome APIs (`chrome.tabs`, `chrome.scripting`, `chrome.runtime`). It handles screen captures and script injection.
  4.  **Message Routing**: It acts as a router, for example, taking a request from the content script and forwarding the necessary data to the side panel.

### c. Content Script (`contentScript.ts`)

- **Role**: This script is injected into web pages and handles direct interaction with the page's DOM. It is responsible for the visual selection tool.
- **Functionality**:
  1.  **Brush Tool**: Listens for a message from the side panel to activate. It then creates a transparent `<canvas>` overlay on the page, allowing the user to draw a free-form selection.
  2.  **Context Menu**: When the user finishes drawing, a small context menu appears near the selection with an "Analyze section" button.
  3.  **Communication**: It sends the coordinates of the drawn area to the background script for processing.
  4.  **Styling**: The context menu is styled dynamically to match the extension's dark theme.

### d. Local LLM Server (External)

- **Technology**: The user is expected to run an LLM (e.g., Gemma) with vision capabilities via **LM Studio**.
- **API**: LM Studio exposes an **OpenAI-compatible API** at `http://localhost:1234`.
- **Interaction**: The React UI communicates directly with this local server via standard `fetch` requests to the `/v1/chat/completions` endpoint, sending the conversation history (including images) and receiving the model's response.

### e. Speech-to-Text (STT) Integration

To enable voice input, the extension uses a combination of an offscreen document and a local Python server.

-   **Offscreen Document (`offscreen.html`)**: Because Service Workers cannot directly access the microphone, an offscreen document is used to run the necessary `navigator.mediaDevices.getUserMedia` API. The background script creates and manages this document to handle audio recording.
-   **Microphone Access Page (`microphone-access.html`)**: A dedicated HTML page is used to explicitly request microphone permissions from the user if they have not yet been granted.
-   **STT Server (`stt_server.py`)**: A separate, local Flask server that exposes a `/transcribe` endpoint. It receives raw audio data, uses the `whisper` library to perform speech-to-text conversion, and returns the transcribed text. This server must be running locally for the feature to work.

## 3. Communication Flow & Data

The components communicate through four primary channels:

### a. Chat with LLM

1.  **User**: Types a message in the side panel's input field and hits "Send".
2.  **App.tsx**: The `handleSend` function updates the UI with the user's message, sets a `loading` state, and formats the entire message history into a payload.
3.  **Fetch API**: A `POST` request is sent to `http://localhost:1234/v1/chat/completions` with the payload.
4.  **LM Studio**: Processes the request and returns the LLM's response.
5.  **App.tsx**: The response is received, the `loading` state is cleared, and the UI is updated with the bot's message, rendered via `react-markdown`.

### b. Agentic Actions (Capture/Read Page)

1.  **User**: Clicks the "Capture" or "Read Page" icon in the side panel.
2.  **App.tsx**: An action message (e.g., `{type: 'captureScreen'}`) is sent to the background script via `chrome.runtime.sendMessage`. The `loading` state is set.
3.  **background.ts**: The `onMessage` listener catches the request. It uses `chrome.tabs.query` to find the active tab.
4.  **Chrome API**: The background script calls the relevant Chrome API (`captureVisibleTab` or `scripting.executeScript`).
5.  **background.ts**: When the API call completes, it sends the result (or an error) back to the side panel via `chrome.runtime.sendMessage`.
6.  **App.tsx**: The `useEffect` message listener receives the response, clears the `loading` state, and updates the UI with the result.

### c. Area Analysis (Brush Tool)

1.  **User**: Clicks the "Brush" icon in the side panel.
2.  **App.tsx**: Sends an `activateSelection` message to the content script for the active tab via `chrome.tabs.sendMessage`.
3.  **contentScript.ts**: Receives the message and activates the brush tool by adding a `mousedown` listener to the window.
4.  **User**: Clicks and drags on the page to draw a selection. The script tracks the path on the canvas overlay.
5.  **contentScript.ts**: On `mouseup`, it displays the "Analyze section" context menu.
6.  **User**: Clicks the "Analyze section" button.
7.  **contentScript.ts**: Sends an `analyzeArea` message to the background script, containing the bounding box of the drawn path.
8.  **background.ts**: Receives the message and calls `chrome.tabs.captureVisibleTab` to get a screenshot of the page.
9.  **background.ts**: Sends a `cropAndAnalyze` message to the side panel UI, containing the full screenshot `dataUrl` and the `area` coordinates.
10. **App.tsx**: The `useEffect` listener receives the message. It calls the `cropImage` helper function to crop the screenshot to the selected area.
11. **App.tsx**: The cropped image is added to the chat UI, and a `fetch` request is sent to the local LLM with the image and a prompt to analyze it.
12. **LM Studio**: Processes the request and returns the analysis.
13. **App.tsx**: The response is received and rendered in the chat window using the `react-markdown` component for rich formatting.

### d. Voice Recognition (Speech-to-Text)

1.  **User**: Clicks the "Mic" icon in the side panel.
2.  **App.tsx**: The `handleMicrophoneClick` function checks for microphone permissions using `navigator.permissions.query`.
    *   If permissions are denied, it shows an alert.
    *   If permissions are not yet granted (`prompt`), it sends an `open-microphone-access` message to the background script, which opens the dedicated `microphone-access.html` page to request permission.
    *   If permissions are granted, it sends a `start-recording` message to the background script and updates the UI to a "recording" state.
3.  **background.ts**: On receiving `start-recording`, it ensures an offscreen document is active (creating one via `offscreenManager.ts` if needed). It then forwards the `start-recording` message to the offscreen document.
4.  **offscreen.ts**: The offscreen script calls `navigator.mediaDevices.getUserMedia` to start capturing audio. It sends the recorded audio data (as a `dataURL`) back to the background script when recording stops.
5.  **User**: Clicks the "Mic" icon again to stop.
6.  **App.tsx**: Sends a `stop-recording` message to the background script.
7.  **background.ts**: Forwards the `stop-recording` message to the offscreen document.
8.  **offscreen.ts**: Stops the media stream. The collected audio data is sent to the background script.
9.  **background.ts**: Receives the audio `dataURL` and `POST`s it to the local STT server at `http://localhost:5000/transcribe`.
10. **stt_server.py**: The Flask server receives the audio data, decodes it, saves it to a temporary file, transcribes it using the `whisper` model, and returns the resulting text as JSON.
11. **background.ts**: Receives the transcribed text from the server and sends it to the side panel UI via a `transcription-result` message.
12. **App.tsx**: A listener catches the `transcription-result` message and updates the chat input field with the received text.

## 4. What We've Done: Project History

1.  **Initialization**: Set up a Vite + React + TypeScript project from scratch.
2.  **Manifest & Build Config**: Created the `manifest.json` for a side panel extension and configured `vite.config.ts` to build the necessary HTML, JS, and background scripts.
3.  **Basic UI**: Built the core chat interface with React components and CSS.
4.  **LLM Integration**: Implemented `fetch` logic to connect the UI to the local LM Studio server.
5.  **Agent Capabilities**:
    - Added a "Capture Screen" feature using `chrome.tabs.captureVisibleTab`.
    - Added a "Read Page" feature using `chrome.scripting.executeScript`.
6.  **Debugging & Refinement**:
    - Solved multiple build and configuration issues related to file paths and module resolution.
    - Fixed critical runtime errors, including permission errors and race conditions.
    - Corrected the LLM payload structure to support conversational history.
7.  **UI Polish**: Replaced text buttons with icons from `lucide-react` and refactored the CSS for responsiveness.
8.  **Brush Selection & Area Analysis**:
    - Implemented a `contentScript` with a `<canvas>` overlay for drawing on the page.
    - Added a context menu to trigger analysis of the selected area.
    - Built the communication pipeline (`contentScript` -> `background` -> `sidePanel`) to capture, crop, and send the selected image region to the LLM.
9.  **Advanced UI/UX Overhaul**:
    - Designed and implemented a complete dark theme for the side panel and context menu.
    - Integrated `react-markdown` to parse and beautifully render the LLM's text responses, including lists, code blocks, and other formatting.
    - Fixed a critical UX flaw where clicking the context menu would incorrectly trigger a new drawing action.