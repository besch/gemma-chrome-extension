# stt_server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import whisper
import numpy as np
import tempfile # Import tempfile for creating temporary files
import os       # Import os for file operations

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Load the Whisper model
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    data = request.json
    audio_data_url = data.get('audio')

    if not audio_data_url:
        return jsonify({"error": "No audio data provided"}), 400

    try:
        header, base64_string = audio_data_url.split(',')
        audio_bytes = base64.b64decode(base64_string)

        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio_file:
            temp_audio_file.write(audio_bytes)
            temp_audio_path = temp_audio_file.name

        # Load the audio from the temporary file into a NumPy array
        audio_np = whisper.load_audio(temp_audio_path)

        # Transcribe the audio from the NumPy array
        result = model.transcribe(audio_np)
        transcribed_text = result["text"]

        return jsonify({"text": transcribed_text})

    except Exception as e:
        print(f"Error during transcription: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        # Ensure the temporary file is deleted, even if an error occurs
        if 'temp_audio_path' in locals() and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)