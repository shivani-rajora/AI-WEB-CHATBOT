# AI Chatbot Web App

Flask + HTML/CSS/JS front end for a Gemini chatbot.
Chats are saved with Pandas, stats use NumPy, charts use Matplotlib + Seaborn.

## Setup
1. Open a terminal inside this folder.
2. (Recommended) Create a virtual environment:
   ```
   python -m venv venv
   venv\Scripts\activate        # Windows
   source venv/bin/activate     # Mac/Linux
   ```
3. Install libraries:
   ```
   pip install -r requirements.txt
   ```
4. Copy `_env.example` to `.env` and add your free Gemini key:
   ```
   GEMINI_API_KEY=your_key_here
   ```
   Get a key at https://aistudio.google.com/apikey

## Run
```
python app.py
```
Open http://127.0.0.1:5000 in your browser.

(The old command-line version still works: `python chatbot.py`)

## Features
- Live chat with typing indicator and response time
- Sidebar tools: new conversation, recent chats, statistics, charts, models
- Responsive layout (works on mobile) with automatic dark mode

## Troubleshooting
- "GEMINI_API_KEY not found": make sure `.env` is in the same folder as `app.py`.
- Always run `python app.py` from inside this folder so `data/` and `charts/` are created here.
- Charts need at least 2 saved chats.
