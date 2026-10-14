# sommyart-voice-studio

{
  "name": "Sommyart Text-to-Voice Studio",
  "description": "Convert any text into expressive AI voiceovers with background music using the open-source Nari-Labs Dia-1.6B model via Hugging Face Fal.ai.",
  "actions": [
    {
      "action": "call_api",
      "method": "POST",
      "url": "https://api.fal.ai/v1/models/nari-labs/Dia-1.6B/tts",
      "headers": {
        "Authorization": "Bearer YOUR_HF_API_KEY",
        "Content-Type": "application/json"
      },
      "body": {
        "text": "{{input_text}}",
        "voice": "{{voice_style}}"
      },
      "response_handling": {
        "type": "binary",
        "output_file": "sommyart_voice_raw.mp3"
      }
    },
    {
      "action": "call_api",
      "method": "POST",
      "url": "https://api.fal.ai/v1/models/audio-mixer",
      "headers": {
        "Authorization": "Bearer YOUR_HF_API_KEY",
        "Content-Type": "application/json"
      },
      "body": {
        "voice_track": "sommyart_voice_raw.mp3",
        "background_music": "{{music_choice}}",
        "volume_balance": "0.8"
      },
      "response_handling": {
        "type": "binary",
        "output_file": "sommyart_voice_mix.mp3"
      }
    },
    {
      "action": "play_audio",
      "source": "sommyart_voice_mix.mp3"
    }
  ],
  "ui": {
    "input_fields": [
      {
        "id": "input_text",
        "label": "Enter Text",
        "placeholder": "Type or paste your script here..."
      },
      {
        "id": "voice_style",
        "label": "Select Voice Style",
        "type": "dropdown",
        "options": [
          { "label": "Male (Deep Calm)", "value": "male_calm" },
          { "label": "Female (Soft Clear)", "value": "female_soft" },
          { "label": "Narrator (Neutral)", "value": "narrator" },
          { "label": "Emotional (Expressive)", "value": "emotional" }
        ],
        "default": "narrator"
      },
      {
        "id": "music_choice",
        "label": "Choose Background Music",
        "type": "dropdown",
        "options": [
          { "label": "No Music", "value": "" },
          { "label": "Calm Ambient", "value": "https://example.com/audio/calm_ambient.mp3" },
          { "label": "Inspiring Piano", "value": "https://example.com/audio/inspiring_piano.mp3" },
          { "label": "Cinematic Background", "value": "https://example.com/audio/cinematic_bg.mp3" },
          { "label": "Corporate Beat", "value": "https://example.com/audio/corporate_beat.mp3" }
        ],
        "default": ""
      }
    ],
    "buttons": [
      {
        "label": "🎤 Generate Voice",
        "trigger": "call_api"
      },
      {
        "label": "⬇️ Download Voice",
        "trigger": "download_file",
        "source": "sommyart_voice_mix.mp3"
      }
    ],
    "output_elements": [
      {
        "type": "audio_player",
        "label": "Preview Generated Voice",
        "source": "sommyart_voice_mix.mp3"
      }
    ]
  }
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sommyart-voice-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a22317e8-6d17-4be6-a5fb-25fa974d9863).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
