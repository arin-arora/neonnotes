import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB, User, Note } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_neonnotes_jwt_token_key_987";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Support large base64 media uploads in blocks

// Database Connection Middleware
app.use((req, res, next) => {
  const isAuthOrNoteRoute = req.path.startsWith("/api/auth") || req.path.startsWith("/api/notes");
  if (isAuthOrNoteRoute && mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "Database is offline. Please start your local MongoDB database, or check MONGO_URI in backend/.env."
    });
  }
  next();
});

// Connect to MongoDB
connectDB();

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = decoded;
    next();
  });
}

// ── AUTHENTICATION ROUTES ─────────────────────────────────────

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      passwordHash,
      name: name || "",
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// Me (Get profile)
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// ── NOTES CRUD ROUTES ──────────────────────────────────────────

// Get all notes for user
app.get("/api/notes", authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user.id }).sort({ created_at: -1 });
    res.json(notes);
  } catch (error) {
    console.error("Get notes error:", error);
    res.status(500).json({ error: "Server error fetching notes" });
  }
});

// Create note
app.post("/api/notes", authenticateToken, async (req, res) => {
  try {
    const { title, blocks, summary, color, locked, pin, font_size } = req.body;
    const noteId = req.body.id || Math.random().toString(36).slice(2, 9);

    const newNote = new Note({
      id: noteId,
      title: title || "New Note",
      blocks: blocks || [{ type: "text", id: Math.random().toString(36).slice(2, 9), content: "" }],
      summary: summary || null,
      color: color || 0,
      locked: locked || false,
      pin: pin || null,
      fontSize: font_size || 13,
      userId: req.user.id,
    });

    await newNote.save();
    res.status(201).json(newNote);
  } catch (error) {
    console.error("Create note error:", error);
    res.status(500).json({ error: "Server error creating note" });
  }
});

// Update note
app.put("/api/notes/:id", authenticateToken, async (req, res) => {
  try {
    const noteId = req.params.id;
    const updates = { ...req.body };

    // Map frontend's font_size key to backend schema fontSize if provided
    if (updates.font_size !== undefined) {
      updates.fontSize = updates.font_size;
      delete updates.font_size;
    }

    const updatedNote = await Note.findOneAndUpdate(
      { id: noteId, userId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }

    res.json(updatedNote);
  } catch (error) {
    console.error("Update note error:", error);
    res.status(500).json({ error: "Server error updating note" });
  }
});

// Delete note
app.delete("/api/notes/:id", authenticateToken, async (req, res) => {
  try {
    const noteId = req.params.id;
    const deletedNote = await Note.findOneAndDelete({ id: noteId, userId: req.user.id });

    if (!deletedNote) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }

    res.json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    console.error("Delete note error:", error);
    res.status(500).json({ error: "Server error deleting note" });
  }
});


// ── AI SUMMARY ROUTE ───────────────────────────────────────────

app.post("/api/summarize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for summarization" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server" });
    }

    // Call Gemini API via fetch
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Summarize the following notes text in a concise, bulleted format. Focus on key themes, action items, and takeaways. Keep the summary short (3-4 bullet points) and readable:\n\n${text}`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API error body:", errBody);
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate summary.";

    res.json({ summary });
  } catch (error) {
    console.error("AI Summary generation error:", error);
    res.status(500).json({ error: "Failed to generate summary using Gemini AI" });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
