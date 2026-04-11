const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "public", "data", "ceremonies.json");
const CLUBS_PROJECT_PATH = process.env.CLUBS_PROJECT_PATH || path.join(__dirname, "..", "StevneGrafikk");
const CLUBS_PUBLIC_PATH = path.join(CLUBS_PROJECT_PATH, "public");
const CLUBS_LOGO_PATH = path.join(CLUBS_PUBLIC_PATH, "assets", "logos");
const CLUBS_BG_PATH = path.join(CLUBS_PUBLIC_PATH, "assets", "backgrounds");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve club logos stored in the project-root "logos" folder
app.use("/logos/clubs", express.static(path.join(__dirname, "logos")));
// Serve background images from project-root "background" folder
app.use("/background", express.static(path.join(__dirname, "background")));
// Serve integrated clubs assets from the sibling StevneGrafikk project
app.use("/clubs-assets", express.static(path.join(CLUBS_PUBLIC_PATH, "assets")));

const ensureDataFile = () => {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify(
        {
          ceremonies: [],
          swimmers: [],
          clubs: []
        },
        null,
        2
      )
    );
  }
};

const readData = () => {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return JSON.parse(raw);
};

const writeData = (data) => {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
};

let state = {
  selectedCeremonyId: null,
  display: {
    blank: true
  },
  clubs: {
    currentIndex: 0
  },
  messages: {
    blank: true,
    title: "Beskjeder til svommere",
    lines: [],
    currentIndex: -1,
    text: ""
  }
};

const isImageFile = (fileName) => /\.(png|jpe?g|webp|gif)$/i.test(fileName);

const firstClubBackgroundPath = () => {
  try {
    const backgrounds = fs.readdirSync(CLUBS_BG_PATH).filter(isImageFile);
    if (backgrounds.length === 0) return "";
    return `/clubs-assets/backgrounds/${encodeURIComponent(backgrounds[0])}`;
  } catch {
    return "";
  }
};

const buildClubSlides = () => {
  let logoFiles = [];
  try {
    logoFiles = fs.readdirSync(CLUBS_LOGO_PATH).filter(isImageFile);
  } catch {
    logoFiles = [];
  }

  logoFiles.sort((fileA, fileB) => {
    const nameA = path.parse(fileA).name;
    const nameB = path.parse(fileB).name;
    const isBodoA = nameA.toLocaleLowerCase("nb").trim() === "bodø sk";
    const isBodoB = nameB.toLocaleLowerCase("nb").trim() === "bodø sk";

    if (isBodoA && !isBodoB) return 1;
    if (!isBodoA && isBodoB) return -1;

    return nameA.localeCompare(nameB, "nb", { sensitivity: "base" });
  });

  const background = firstClubBackgroundPath();
  return logoFiles.map((fileName) => ({
    teamName: path.parse(fileName).name,
    logo: `/clubs-assets/logos/${encodeURIComponent(fileName)}`,
    background
  }));
};

let clubSlides = buildClubSlides();

const clampClubIndex = (index) => {
  if (clubSlides.length === 0) return 0;
  if (index < 0) return 0;
  if (index >= clubSlides.length) return clubSlides.length - 1;
  return index;
};

const refreshClubSlides = () => {
  clubSlides = buildClubSlides();
  state.clubs.currentIndex = clampClubIndex(state.clubs.currentIndex);
};

const normalizeMessageLines = (lines) => {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 200);
};

const pickMessageText = (messagesState) => {
  if (messagesState.blank === true) return "";
  if (messagesState.text) return messagesState.text;
  if (messagesState.currentIndex >= 0 && messagesState.lines[messagesState.currentIndex]) {
    return messagesState.lines[messagesState.currentIndex];
  }
  return "";
};

const emitClubState = (target = io) => {
  refreshClubSlides();
  target.emit("clubs:update", {
    currentIndex: state.clubs.currentIndex,
    totalSlides: clubSlides.length,
    slides: clubSlides
  });
};

const emitMessageState = (target = io) => {
  const lines = normalizeMessageLines(state.messages.lines);
  state.messages.lines = lines;
  state.messages.currentIndex = Math.max(-1, Math.min(state.messages.currentIndex, lines.length - 1));
  state.messages.text = pickMessageText(state.messages);

  target.emit("messages:update", {
    ...state.messages
  });
};

app.get("/api/data", (req, res) => {
  try {
    const data = readData();
    res.json({ data, state });
  } catch (err) {
    res.status(500).json({ error: "Could not read data", details: err.message });
  }
});

app.post("/api/data", (req, res) => {
  try {
    const payload = req.body;
    writeData(payload);
    io.emit("data:update", payload);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not save data", details: err.message });
  }
});

app.post("/api/state", (req, res) => {
  try {
    const incoming = req.body || {};
    state = {
      ...state,
      ...incoming,
      display: {
        ...state.display,
        ...(incoming.display || {})
      },
      clubs: {
        ...state.clubs,
        ...(incoming.clubs || {})
      },
      messages: {
        ...state.messages,
        ...(incoming.messages || {})
      }
    };

    state.messages.lines = normalizeMessageLines(state.messages.lines);
    state.messages.currentIndex = Math.max(-1, Math.min(state.messages.currentIndex, state.messages.lines.length - 1));
    state.messages.text = pickMessageText(state.messages);

    io.emit("state:update", state);
    emitClubState();
    emitMessageState();
    res.json({ ok: true, state });
  } catch (err) {
    res.status(500).json({ error: "Could not update state", details: err.message });
  }
});

app.get("/api/clubs/slides", (req, res) => {
  refreshClubSlides();
  res.json({
    slides: clubSlides,
    currentIndex: state.clubs.currentIndex
  });
});

app.get("/api/messages", (req, res) => {
  const lines = normalizeMessageLines(state.messages.lines);
  state.messages.lines = lines;
  state.messages.currentIndex = Math.max(-1, Math.min(state.messages.currentIndex, lines.length - 1));
  state.messages.text = pickMessageText(state.messages);
  res.json({ ...state.messages });
});

app.get("/control", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "control-hub.html"));
});

app.get("/control/awards", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "control.html"));
});

app.get("/control/clubs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "clubs-control.html"));
});

app.get("/control/messages", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "messages-control.html"));
});

app.get("/display", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "display.html"));
});

app.get("/display/clubs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "clubs-display.html"));
});

app.get("/display/messages", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "messages-display.html"));
});

io.on("connection", (socket) => {
  socket.emit("state:update", state);
  emitClubState(socket);
  emitMessageState(socket);

  socket.on("clubs:next", () => {
    refreshClubSlides();
    state.clubs.currentIndex = clampClubIndex(state.clubs.currentIndex + 1);
    emitClubState();
  });

  socket.on("clubs:prev", () => {
    refreshClubSlides();
    state.clubs.currentIndex = clampClubIndex(state.clubs.currentIndex - 1);
    emitClubState();
  });

  socket.on("clubs:set", (index) => {
    if (typeof index !== "number") return;
    refreshClubSlides();
    state.clubs.currentIndex = clampClubIndex(index);
    emitClubState();
  });

  socket.on("messages:update", (patch) => {
    state.messages = {
      ...state.messages,
      ...(patch || {})
    };
    emitMessageState();
  });

  try {
    const data = readData();
    socket.emit("data:update", data);
  } catch {
    // Ignore initial data errors on connect; API will report details if needed.
  }
});

server.listen(PORT, () => {
  console.log(`Premieutdeling server running on http://localhost:${PORT}`);
  console.log("Control views:");
  console.log("  /control (tabbed hub)");
  console.log("  /control/awards");
  console.log("  /control/clubs");
  console.log("  /control/messages");
  console.log("Display views:");
  console.log("  /display");
  console.log("  /display/clubs");
  console.log("  /display/messages");
});
