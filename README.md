# ⚡ Neon Notes fullstack

A premium, highly interactive neon-themed notes application powered by Express, MongoDB, and Gemini AI.

---

## 🚀 One-Click Production Deployment

Deploy the application permanently to the cloud and get a public domain URL for free in minutes!

### Step 1: Deploy the Backend (Render)
Deploy your Express server and connect it to MongoDB Atlas.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/arin-arora/neonnotes)

*During deployment, Render will ask you for:*
- `MONGO_URI`: `mongodb+srv://arin098arora_db_user:AarohiCheat2907@cluster0.lde9fs3.mongodb.net/neonnotes?retryWrites=true&w=majority&appName=Cluster0`
- `GEMINI_API_KEY`: *Your Google AI Studio API key*
- *`JWT_SECRET` is automatically generated for you.*

*Once deployed, copy your backend's Render URL (e.g., `https://neonnotes-backend.onrender.com`).*

---

### Step 2: Deploy the Frontend (Vercel)
Deploy your React application and hook it up to your backend.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farin-arora%2Fneonnotes&root-directory=frontend&env=VITE_API_URL)

*During deployment, Vercel will ask you for:*
- `VITE_API_URL`: `https://YOUR_RENDER_BACKEND_URL/api` (e.g., `https://neonnotes-backend-xyz.onrender.com/api`)

---

## 🛠️ Local Development

To run the application locally on localhost:

1. Clone the repository and run dependencies installation:
   ```bash
   npm run install:all
   ```
2. Start both frontend and backend dev servers concurrently:
   ```bash
   npm start
   ```
3. Open your browser to `http://localhost:5173`.
