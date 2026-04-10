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

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve club logos stored in the project-root "logos" folder
app.use("/logos/clubs", express.static(path.join(__dirname, "logos")));
// Serve background images from project-root "background" folder
app.use("/background", express.static(path.join(__dirname, "background")));

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
  }
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
    state = {
      ...state,
      ...req.body,
      display: {
        ...state.display,
        ...(req.body.display || {})
      }
    };
    io.emit("state:update", state);
    res.json({ ok: true, state });
  } catch (err) {
    res.status(500).json({ error: "Could not update state", details: err.message });
  }
});

app.get("/control", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "control.html"));
});

app.get("/display", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "display.html"));
});

io.on("connection", (socket) => {
  socket.emit("state:update", state);
  try {
    const data = readData();
    socket.emit("data:update", data);
  } catch {
    // Ignore initial data errors on connect; API will report details if needed.
  }
});

server.listen(PORT, () => {
  console.log(`Premieutdeling server running on http://localhost:${PORT}`);
  console.log("Control view: /control");
  console.log("Display view: /display");
});
