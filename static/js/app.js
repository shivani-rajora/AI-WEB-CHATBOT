// ---------- Grab page elements ----------
const messages = document.getElementById("messages");
const form = document.getElementById("chatForm");
const input = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");

// ---------- Small helpers ----------
const scrollDown = () => (messages.scrollTop = messages.scrollHeight);

// Turn Gemini's text into safe HTML (code blocks, bold, lists)
function render(text) {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```\w*\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^\s*[*-] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m.replace(/\n/g, "")}</ul>`);
  // Convert line breaks only outside <pre> and <ul>
  return html
    .split(/(<pre>[\s\S]*?<\/pre>|<ul>[\s\S]*?<\/ul>)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\n/g, "<br>")))
    .join("");
}

// Add a message bubble. `html` = true means content is already safe HTML.
function addMessage(role, content, { html = false, meta = "", error = false } = {}) {
  const div = document.createElement("div");
  div.className = `msg ${role}${error ? " error" : ""}`;
  if (html) div.innerHTML = content;
  else div.textContent = content;
  if (meta) div.insertAdjacentHTML("beforeend", `<span class="meta">${meta}</span>`);
  messages.appendChild(div);
  scrollDown();
  return div;
}

const showTyping = () =>
  addMessage("bot", '<div class="typing"><span></span><span></span><span></span></div>', { html: true });

// Call a backend route and return JSON (throws a readable error)
async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---------- Sending a question ----------
async function sendMessage(text) {
  addMessage("user", text);
  sendBtn.disabled = true;
  const typing = showTyping();
  try {
    const data = await api("/api/chat", "POST", { message: text });
    typing.remove();
    addMessage("bot", render(data.answer), { html: true, meta: `answered in ${data.seconds} sec` });
  } catch (err) {
    typing.remove();
    addMessage("bot", err.message, { error: true });
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.style.height = "auto";
  sendMessage(text);
});

// Enter = send, Shift+Enter = new line; textarea grows as you type
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

// ---------- Sidebar tools ----------
const actions = {
  async reset() {
    await api("/api/reset", "POST");
    messages.innerHTML = "";
    welcome();
  },
  async history() {
    const rows = await api("/api/history");
    if (!rows.length) return addMessage("bot", "No chats saved yet.");
    const list = rows
      .map((r) => `<li>#${r.chat_no} – ${r.question.replace(/</g, "&lt;")} <em>(${r.response_time_sec}s)</em></li>`)
      .join("");
    addMessage("bot", `<strong>Your last chats</strong><ul>${list}</ul>`, { html: true });
  },
  async stats() {
    const s = await api("/api/stats");
    if (s.empty) return addMessage("bot", "No chats yet. Ask a question first!");
    const card = (value, label) => `<div class="card"><b>${value}</b><span>${label}</span></div>`;
    let html = "<strong>Chat summary</strong><div class='cards'>" +
      card(s.total, "Total chats") + card(s.avg_time + "s", "Avg response") +
      card(s.median_time + "s", "Median response") + card(s.slowest + "s", "Slowest") +
      card(s.avg_words, "Avg answer words") + "</div>";
    if (s.prediction !== null)
      html += `<span class="meta">Predicted answer for a 10-word question: ${s.prediction} words</span>`;
    addMessage("bot", html, { html: true });
  },
  async charts() {
    const data = await api("/api/charts", "POST");
    const t = Date.now(); // avoids showing old cached images
    const imgs = data.charts.map((url) => `<img src="${url}?t=${t}" alt="chart">`).join("");
    addMessage("bot", `<strong>Your charts</strong>${imgs}`, { html: true });
  },
  async models() {
    const data = await api("/api/models");
    const list = data.models.map((m) => `<li>${m}</li>`).join("");
    addMessage("bot", `<strong>Available models</strong><ul>${list}</ul>`, { html: true });
  },
};

document.querySelectorAll(".tool").forEach((btn) =>
  btn.addEventListener("click", async () => {
    sidebar.classList.remove("open");
    try {
      await actions[btn.dataset.action]();
    } catch (err) {
      addMessage("bot", err.message, { error: true });
    }
  })
);

document.getElementById("menuBtn").addEventListener("click", () => sidebar.classList.toggle("open"));

// ---------- Welcome message with clickable suggestions ----------
function welcome() {
  const ideas = ["Explain Python lists", "What is machine learning?", "Give me a study tip"];
  const chips = ideas.map((i) => `<button class="chip">${i}</button>`).join("");
  const div = addMessage("bot", `👋 Hi! I'm your AI assistant. Ask me anything.<div class="chips">${chips}</div>`, { html: true });
  div.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => sendMessage(c.textContent)));
}
welcome();
