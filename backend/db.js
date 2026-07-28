import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/neonnotes";

export async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    // Do not call process.exit(1) so the Express server stays up and can return clean API errors!
  }
}

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Note Schema
const noteSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    default: "New Note",
  },
  blocks: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  summary: {
    type: String,
    default: null,
  },
  color: {
    type: Number,
    default: 0,
  },
  locked: {
    type: Boolean,
    default: false,
  },
  pin: {
    type: String,
    default: null,
  },
  fontSize: {
    type: Number,
    default: 13,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
    default: null,
  },
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" } // Match Supabase column naming convention for ease of compatibility
});

export const User = mongoose.model("User", userSchema);
export const Note = mongoose.model("Note", noteSchema);
