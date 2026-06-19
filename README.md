# ClearClause

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)

An AI-powered legal document simplifier and analyzer designed to translate dense, jargon-heavy legal documents into plain English. Upload any digital or scanned legal agreement (NDAs, rental agreements, offer letters, loans), run instant automated risk assessments, download formatted PDF reports, and chat interactively with your document using a local RAG (Retrieval-Augmented Generation) pipeline.

---

## 🌟 Key Engineering Highlights

*   **Asynchronous Background Job Queue:** Decouples file uploads from text extraction and embedding generation using **Redis** and **BullMQ** to handle high-concurrency workloads smoothly without blocking the main event loop.
*   **Intelligent Hybrid OCR Pipeline:** Extracts text from digital PDFs natively using **PDF.js**. If the file has no selectable text (scanned images/photos), it automatically falls back to **Tesseract OCR** with native support for English and Hindi datasets.
*   **Vector Database & Semantic Search (RAG):** Segments document text into overlapping chunks, computes embeddings via **Cohere API** (using `embed-english-v3.0`), and stores vectors in **PostgreSQL** using the **pgvector** extension. Features custom cosine-similarity queries to context-ground interactive QA chat sessions.
*   **Real-Time Streaming Interface:** Integrates **Server-Sent Events (SSE)** to stream section-by-section analysis and RAG-based AI chat answers token-by-token, mimicking a highly responsive, modern chat app experience.
*   **Multi-Model Failover Resiliency:** Connects primary prompts to **Google Gemini 2.5 Flash** for rapid, structured legal reasoning. Automatically falls back to **Groq SDK (Llama-3.3-70B)** in case of API rate limits or outages to guarantee high uptime.
*   **Pixel-Perfect PDF Generation:** Generates styled, print-ready PDF summaries of the legal analyses on-the-fly using **pdfkit**, allowing users to save and share offline summaries with custom risk badges.

---

## 🏗️ System Architecture

The project is structured as a decoupled client-server monorepo, orchestrating background queues, relational & vector data storage, and external AI providers.

```mermaid
graph TD
    %% Frontend Layer
    subgraph Client [Client - React + Vite + Tailwind CSS]
        UI[React View]
        Upload[Dropzone File Upload]
        SSE[SSE Stream listener]
        ChatUI[Interactive Chat UI]
    end

    %% Gateway Layer
    subgraph Server [Backend - Node.js + Express]
        API[Express REST API]
        Limiter[Rate Limiter & Auth JWT]
        Uploader[Multer Local Upload]
    end

    %% Queue & Cache Layer
    subgraph Queues [Job Management - BullMQ]
        DocQueue[document-processing Queue]
        EmbedQueue[embedding-processing Queue]
    end
    Redis[(Redis Cache & Queue Store)]

    %% Worker Layer
    subgraph Workers [Asynchronous Workers]
        DocWorker[Document Worker: PDFjs & Tesseract OCR]
        EmbedWorker[Embedding Worker: Cohere API]
    end

    %% DB & AI Layer
    subgraph Storage [Storage Layer]
        DB[(PostgreSQL + pgvector)]
    end

    subgraph AILayer [AI Reasoning Layer]
        Gemini[Google Gemini 2.5 Flash]
        Groq[Groq Llama-3.3-70B]
        Cohere[Cohere Embeddings]
    end

    %% Connections
    UI -->|1. HTTP Upload| Upload
    Upload -->|File Multipart| Uploader
    Uploader --> API
    API -->|2. Register Job| DocQueue
    DocQueue -->|Backing Store| Redis
    EmbedQueue -->|Backing Store| Redis

    DocWorker -->|Listen| DocQueue
    EmbedWorker -->|Listen| EmbedQueue
    
    DocWorker -->|3. Extract Text| DB
    DocWorker -->|4. Trigger Embedding| EmbedQueue
    
    EmbedWorker -->|5. Vectorize Chunks| Cohere
    EmbedWorker -->|6. Save Chunks & Vectors| DB

    UI -->|7. Listen SSE Stream| SSE
    SSE --> API
    API -->|8. Analysis Prompt| Gemini
    Gemini -.->|Failover| Groq
    API -->|9. Serve Cached Result| DB
    
    ChatUI -->|10. Ask Question| API
    API -->|11. Query Query-Embedding| Cohere
    API -->|12. Semantic Similarity Search| DB
    API -->|13. Context-Grounded Prompt| Gemini
    
    API -->|14. SSE Chunks| SSE
```

---

## 🗄️ Database Schema Design

The schema uses PostgreSQL relational tables coupled with vector column definitions to power persistent logins, document metadata tracking, and similarity searches.

```
                  ┌──────────────┐
                  │    users     │
                  └──────┬───────┘
                         │ 1
                         │
                         │ 0..*
                  ┌──────▼───────┐
                  │  documents   │
                  └──────┬───────┘
                         │
        ┌────────────────┴────────────────┐
        │ 1                               │ 1
        │                                 │
  ┌─────▼─────┐                     ┌─────▼─────┐
  │ analyses  │                     │embeddings │
  └───────────┘                     └───────────┘
```

1.  **`users`**: Manages secure email authentication and credentials using password hashes.
2.  **`documents`**: Keeps track of file uploads, metadata (page count, scanned status), processing status (`pending`, `processing`, `ready`, `done`, `failed`), and public sharing tokens.
3.  **`analyses`**: Caches the structured output of the AI analysis (overall summaries, risk levels, key dates, key amounts, and clause breakdowns) to avoid repetitive external model API costs.
4.  **`embeddings`**: Houses segmented document text chunks paired with their calculated vector representations of type `vector(1024)`, backed by an **IVFFlat** cosine-similarity index for RAG queries.
5.  **`refresh_tokens`**: Manages JWT refresh cycles to maintain security and persistent sessions.

---

## 🔄 Core Workflows Explained

### 1. Document Upload & Processing Pipeline

```
[User Uploads PDF] ──> [Saved to disk & DB] ──> [Enqueued to BullMQ]
                                                     │
   ┌───────────────── <Digital PDF Extract> ─────────┴───────── <Scanned PDF OCR>
   ▼                                                                    ▼
[PDF.js reads text]                                            [pdf-to-img page buffers]
   │                                                                    │
   ├─> (Length < 100 Chars? fallback) ──> (Yes) ──>                     │
   │                                                                    ▼
   │                                                           [Tesseract reads eng+hin]
   ▼                                                                    │
[Save text to DB & update status to 'ready'] <──────────────────────────┘
   │
   ▼
[Enqueue embedding job to BullMQ] ──> [Cohere Vectorizes chunks] ──> [Save vectors to DB]
```

### 2. Context-Aware RAG Chat Workflow

When a user asks a question about an analyzed document:
1.  **Query Vectorization:** The query text is vectorized using Cohere's `search_query` model.
2.  **Cosine Similarity Search:** A database query returns the top 5 closest matching chunks from the `embeddings` table using the pgvector `<=>` operator (cosine distance).
3.  **Opening Chunk Injection:** To preserve core metadata (names of parties, date of execution, agreement title), Chunk 0 (the first 2000 characters of the document) is automatically prepended to the context.
4.  **Strict Prompt Grounding:** A system prompt compiles this background into a context window and restricts the LLM to *only* reply based on the provided text, flagging any unusual contract risks with a `⚠️` icon.

---

## 🛠️ Environment Variables Configuration

Create a `.env` file in the `server` directory. Refer to the table below to configure the app:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Local Express Server port | `5001` |
| `NODE_ENV` | Mode of deployment | `development` or `production` |
| `CORS_ORIGIN` | Allowed domains for client requests | `http://localhost:5173,http://localhost:5174` |
| `DB_USER` | PostgreSQL User | `postgres` |
| `DB_PASSWORD` | PostgreSQL Password | `postgres` |
| `DB_NAME` | PostgreSQL Database name | `clearclause` |
| `DATABASE_URL` | PostgreSQL Connection string | `postgresql://postgres:postgres@localhost:5432/clearclause` |
| `REDIS_URL` | Redis instance URL | `redis://localhost:6379` |
| `JWT_SECRET` | Token signature key | `your_super_secret_jwt_key_here` |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Refresh token duration | `7` |
| `GEMINI_API_KEY` | Google Generative AI API access key | *Get from Google AI Studio* |
| `GROQ_API_KEY` | Groq console API key | *Get from Groq Console* |
| `COHERE_API_KEY` | Cohere API access key | *Get from Cohere Dashboard* |

---

## 🚀 Installation & Setup

### Option A: Using Docker Compose (Recommended & Easiest)

Running the application using Docker Compose automatically configures a Postgres database initialized with `schema.sql`, a Redis container, the Express server, and the React client.

#### Prerequisites
- Install **Docker** and **Docker Compose** on your system.

#### Running the App
1. Clone the repository and navigate to the project root:
   ```bash
   git clone https://github.com/yourusername/ClearClause.git
   cd ClearClause
   ```
2. Create `server/.env` and insert your API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `COHERE_API_KEY`).
3. Boot the environment:
   ```bash
   docker compose up --build
   ```
4. Access the applications:
   - **Frontend App:** `http://localhost` (or `http://localhost:80`)
   - **Backend Server API:** `http://localhost:5001`

---

### Option B: Manual Local Setup (Step-by-Step)

If you prefer to run services natively on your host machine:

#### Prerequisites
- **Node.js** v20+ & **npm**
- **Redis** running locally (`6379`)
- **PostgreSQL** running locally (`5432`) with the **pgvector** extension installed.

#### 1. Setup the Database
Create a new database named `clearclause` in PostgreSQL, enable the `vector` extension, and run the schema setup:
```sql
CREATE DATABASE clearclause;
\c clearclause;
CREATE EXTENSION IF NOT EXISTS vector;
```
Import the schema into the database:
```bash
psql -U postgres -d clearclause -f server/schema.sql
```

#### 2. Run Redis
Make sure Redis is active:
```bash
# On Linux/macOS
redis-server

# On Windows (WSL or Docker Container)
docker run -d -p 6379:6379 redis:7-alpine
```

#### 3. Setup and Start Backend Server
```bash
cd server
npm install
```
Configure your `server/.env` file. Start the server (includes running the background workers):
```bash
# Development mode with Nodemon
npm run dev

# Production start
npm start
```
The server will start running on `http://localhost:5001`.

#### 4. Setup and Start Client Frontend
```bash
cd ../client
npm install
```
Create a `.env` file in the client directory if you need to point to a custom API URL:
```env
VITE_API_URL=http://localhost:5001/api
```
Start the local Vite server:
```bash
npm run dev
```
The client app will open on `http://localhost:5173`.

---

## 🔌 API Endpoints Reference

### Authentication Routes (`/api/auth`)
- **`POST /register`**: Register a new user. Expects JSON `{ email, password }`.
- **`POST /login`**: Login user and set secure refresh tokens in cookies. Returns access token.
- **`POST /logout`**: Invalidate tokens and clear authentication cookies.
- **`POST /refresh`**: Issues a new access token using the stored refresh cookie.

### Document Routes (`/api/documents`)
- **`POST /upload`**: Multipart file upload. Expects a single `.pdf` file in the `file` field. Enqueues processing jobs.
- **`GET /user/all`**: Fetch all documents owned by the logged-in user.
- **`GET /:id`**: Fetch specific document metadata.
- **`GET /:id/file`**: Downloads the original PDF file from the server uploads cache.
- **`DELETE /:id`**: Deletes a document, its database records, embeddings, and cached analysis.

### Analysis & Chat Routes (`/api/analyze` & `/api/chat`)
- **`GET /api/analyze/stream/:documentId`**: A Server-Sent Events (SSE) stream returning JSON chunks representing the plain English summary, risk overview, key dates, key amounts, and section breakdowns. Runs LLM and caches the output to database.
- **`POST /api/chat/:documentId`**: Accepts `{ message, history }`. Initiates a context-grounded RAG query and streams the response via SSE.
- **`GET /api/documents/:id/export`**: Generates and streams a custom, highly-styled PDF summary of the legal analysis on-the-fly.

---

## 📜 License & Acknowledgements

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

*   Built with ❤️ to make legal documentation accessible to everyone.
*   Powered by Google Gemini and Groq fallback capabilities.