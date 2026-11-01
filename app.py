"""
app.py
Flask backend: connects the web page to the existing chatbot code.
Run with:  python app.py
"""

import os
import threading

import numpy as np
from flask import Flask, jsonify, render_template, request, send_from_directory
from google.genai import errors

import analytics
import chat_logger
import config
from gemini_client import GeminiChatbot

app = Flask(__name__)
lock = threading.Lock()  # one request at a time touches the bot / CSV / charts

# Create the chatbot once when the server starts
try:
    bot = GeminiChatbot()
    setup_error = None
except ValueError as error:
    bot = None
    setup_error = str(error)


@app.get("/")
def home():
    """Serve the main page."""
    return render_template("index.html", setup_error=setup_error)


@app.post("/api/chat")
def chat():
    """Send a question to Gemini, save it, return the answer."""
    if bot is None:
        return jsonify(error=setup_error), 500

    question = (request.get_json(silent=True) or {}).get("message", "").strip()
    if not question:
        return jsonify(error="Please type a question."), 400

    try:
        with lock:
            answer, seconds = bot.ask(question)
            chat_logger.save_chat(question, answer, seconds)
    except errors.APIError as error:
        return jsonify(error=f"Gemini API error ({error.code}): {error.message}"), 502
    except Exception as error:
        return jsonify(error=f"Something went wrong: {error}"), 500

    return jsonify(answer=answer, seconds=seconds)


@app.get("/api/history")
def history():
    """Last 5 chats (same as the /history command)."""
    df = chat_logger.load_history()
    last_five = df[["chat_no", "question", "response_time_sec"]].tail(5)
    return app.response_class(last_five.to_json(orient="records"),
                              mimetype="application/json")


@app.get("/api/stats")
def stats():
    """Chat statistics calculated with NumPy (same numbers as /stats)."""
    df = chat_logger.load_history()
    if df.empty:
        return jsonify(empty=True)

    times = df["response_time_sec"].to_numpy()
    q_words = df["question_words"].to_numpy()
    a_words = df["answer_words"].to_numpy()

    result = {
        "empty": False,
        "total": int(len(df)),
        "avg_time": round(float(np.mean(times)), 2),
        "median_time": round(float(np.median(times)), 2),
        "slowest": round(float(np.max(times)), 2),
        "avg_words": round(float(np.mean(a_words))),
        "prediction": None,
    }
    # Same straight-line prediction as analytics.py
    if len(df) >= 3 and np.std(q_words) > 0:
        slope, intercept = np.polyfit(q_words, a_words, 1)
        result["prediction"] = round(max(slope * 10 + intercept, 0))
    return jsonify(result)


@app.post("/api/charts")
def charts():
    """Create the 3 charts and return their image URLs."""
    df = chat_logger.load_history()
    if len(df) < 2:
        return jsonify(error="Ask at least 2 questions before creating charts."), 400

    with lock:
        analytics.create_charts(df)

    files = ["1_response_time.png", "2_question_vs_answer.png", "3_time_per_chat.png"]
    return jsonify(charts=[f"/charts/{name}" for name in files])


@app.get("/charts/<path:filename>")
def serve_chart(filename):
    """Serve saved chart images."""
    return send_from_directory(os.path.abspath(config.CHARTS_DIR), filename)


@app.get("/api/models")
def models():
    """List Gemini models your key can use."""
    if bot is None:
        return jsonify(error=setup_error), 500
    try:
        return jsonify(models=bot.list_models())
    except Exception as error:
        return jsonify(error=f"Could not list models: {error}"), 500


@app.post("/api/reset")
def reset():
    """Forget the conversation and start fresh."""
    if bot is None:
        return jsonify(error=setup_error), 500
    with lock:
        bot.reset()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
