// src/microphone-access.ts

async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Close the stream immediately after getting permission
    stream.getTracks().forEach(track => track.stop());
    // Close the popup
    window.close();
  } catch (error) {
    console.error("Error requesting microphone permission:", error);
    // Handle permission denied or other errors
    const message = document.createElement('p');
    message.textContent = 'Microphone permission was denied. Please enable it in the extension settings.';
    document.body.appendChild(message);
  }
}

requestMicrophonePermission();
