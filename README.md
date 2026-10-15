# Verity AI Website v3

A responsive, multi-file website with Groq chat, CodeBox, OpenAI image generation, Fish Audio speech, microphone permission handling, and editable User/Verity profiles.

## Project files

```text
verity-ai-website/
├── index.html          # website markup and dialogs
├── css/style.css       # desktop + mobile UI, themes, animations
├── js/app.js           # chat, APIs, voice, profiles, image studio
├── js/codebox.js       # code fence cards, copy and downloads
├── assets/verity-ball.svg
├── server.js           # localhost API relay (no npm packages)
├── package.json
├── start-windows.bat
└── start-unix.sh
```

## Run it (recommended)

Requires **Node.js 18 or newer**. No `npm install` is needed.

### Windows

Double-click `start-windows.bat`, then open **http://127.0.0.1:8787**.

### Android (Termux)

1. Install Termux and run `pkg install nodejs`.
2. Extract this folder somewhere accessible in Termux.
3. `cd` into `verity-ai-website` and run `node server.js`.
4. Open **http://127.0.0.1:8787** in Chrome.

### macOS / Linux

Run `./start-unix.sh` or `node server.js`, then open **http://127.0.0.1:8787**.

**Use the localhost URL rather than opening `index.html` directly**. The local relay lets the browser call providers without exposing API requests to browser CORS restrictions. The server binds to `127.0.0.1` only, and does not log or write API keys to files.

## Configure APIs

Open **Settings & API** (or fill out the first-run setup):

- **Groq API key**: required for text chat and CodeBox. The selected Groq model must still be available to your account.
- **Fish Audio API key**: optional; used for generated speech. Leave the voice ID blank for the provider default, or enter a Fish Audio voice/reference ID. The relay uses model header `s2.1-pro-free`.
- **OpenAI API key**: optional; required for the Image Studio and chat's image command. Images use `gpt-image-1`, which may incur API charges and requires image generation access.

Keys are stored in this browser's local storage and sent with an individual request to the localhost server, then forwarded to the provider. Only enter keys on a device/profile you trust. Do not share local storage exports. Do not expose the server outside localhost without adding real authentication and production security.

## Features

- Independent scrollable conversation with auto-scroll and a jump-to-latest button.
- Chat history and new chat controls.
- Separate editable User and Verity profiles, including a cropped local profile picture for the user.
- CodeBox generates code using Groq and provides copy, download, and HTML preview controls.
- Image Studio uses the OpenAI Images API; generated images can be downloaded as PNGs. The chat also routes prompts starting with “generate an image”, “create an image”, “draw a picture”, or `/image` into image generation.
- Microphone permission explanation and request; speech recognition where the browser supports it; Fish Audio speech with browser speech fallback.
- Light/dark mode and mobile/desktop responsive layouts.
- Exact welcome greeting after first setup: “Hello! Im verity!. Your Personal Helper Friend!. Ask me Anything! I know Everything!”

## Troubleshooting

- **Cannot reach local API server**: start `node server.js` and use `http://127.0.0.1:8787`.
- **Microphone blocked**: allow Microphone for `127.0.0.1:8787` in Chrome site settings, then reload. Browser microphone access requires a supported browser and a secure context such as localhost or HTTPS.
- **Fish Audio failed**: check the key and voice reference ID; try leaving the reference ID blank for the default voice. Check your internet connection and provider access. The app shows the provider's HTTP error details when the request reaches Fish Audio.
- **Image generation failed**: add an OpenAI API key and verify your account has access/billing enabled for image generation. The Groq key is not an image-generation key.
- **Chat model unavailable**: use Refresh models in setup/settings and select a model available to your Groq account.

## Security note

This is a local personal-use development app, not a hardened public hosting setup. The server accepts API keys in POST request bodies, uses no external npm dependencies, and binds to loopback only. Do not port-forward it or deploy it publicly without implementing authentication, rate limits, stronger request validation, and server-side secret storage.
