# ⚡ Neon Notes fullstack

A premium, highly interactive neon-themed notes application powered by Express, MongoDB, and Gemini AI.

---

## 🚀 One-Click Production Deployment

Deploy the **entire application** permanently to the cloud with a single click and get free public domains for both frontend and backend!

### Deploy to Render (Frontend + Backend)

Click the button below to start the unified deployment process:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/arin-arora/neonnotes)

*During deployment, Render will automatically spin up:*
1. **`neonnotes-backend`** (Node/Express API server)
2. **`neonnotes-frontend`** (Vite/React Static Client)

*And Render will prompt you for:*
- **`MONGO_URI`**: `mongodb+srv://arin098arora_db_user:AarohiCheat2907@cluster0.lde9fs3.mongodb.net/neonnotes?retryWrites=true&w=majority&appName=Cluster0`
- **`GEMINI_API_KEY`**: *Your active Gemini API key from Google AI Studio*
- *Note: `JWT_SECRET` will be automatically generated for you, and Render will automatically link the frontend to the backend API!*

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
