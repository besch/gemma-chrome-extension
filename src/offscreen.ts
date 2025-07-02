// src/offscreen.ts

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') {
    return;
  }

  switch (message.type) {
    case 'start-recording':
      startRecording();
      break;
    case 'stop-recording':
      stopRecording();
      break;
  }
});

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('Already recording.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        chrome.runtime.sendMessage({ type: 'audio-recorded', data: reader.result });
      };
      reader.readAsDataURL(audioBlob);
      // Stop the stream tracks
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
  } catch (error) {
    console.error('Error starting recording:', error);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}
