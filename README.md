# WavLang Backend

RESTful API server for WavLang - an intelligent audio transcription and analysis platform. Handles authentication, file processing, AI transcription, and data persistence.

**Frontend Repository:** [wavlang-frontend](https://github.com/JamieJiHeonKim/wavlang-frontend)

---

## Technologies Used

### Core Backend Stack
- **Node.js** - JavaScript runtime environment
- **Express.js** - Fast, minimalist web framework
- **MongoDB + Mongoose** - NoSQL database with ODM
- **JWT (jsonwebtoken)** - Stateless authentication
- **Passport.js** - Authentication middleware
- **Google OAuth 2.0** - Social authentication

### File & Audio Processing
- **Multer** - Multipart form data handling
- **Express-fileupload** - File upload middleware
- **FFmpeg (fluent-ffmpeg)** - Audio processing and manipulation
- **FFmetadata** - Audio metadata extraction
- **UUID** - Unique file identifier generation

### AI & Transcription Services
- **AssemblyAI API** - Advanced speech-to-text transcription
- **OpenAI Whisper API** - AI-powered audio transcription
- **Axios** - HTTP client for external API calls

### Security & Validation
- **bcrypt/bcryptjs** - Password hashing
- **express-validator** - Request validation middleware
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management
- **crypto** - Secure token generation

### Email & Communication
- **Nodemailer** - Email delivery service
- **Form-data** - Multipart form data creation

### Development Tools
- **Nodemon** - Hot reload during development
- **Config** - Configuration management
- **Railway** - Cloud deployment platform

---

## System Architecture

### Design Rationale

This architecture was designed for **scalability**, **security**, and **efficient AI processing** in a production-grade audio transcription platform.

**Key Design Decisions:**

1. **RESTful API Architecture**
   - **Why:** Industry-standard, stateless, cacheable, and flexibility
   - **Usage:** Frontend, mobile apps, and third-party integrations can all consume the same API

2. **Middleware-Based Request Pipeline**
   - **Why:** Modular, reusable, and easy to maintain authentication, validation, and error handling
   - **Usage:** JWT validation, file upload handling, and request logging flow through middleware chain

3. **MongoDB NoSQL Database**
   - **Why:** Flexible schema for evolving data models, horizontal scalability, and fast reads/writes
   - **Usage:** User profiles, transcription history, billing records, and verification tokens

4. **Third-Party AI Services (AssemblyAI, OpenAI)**
   - **Why:** State of the art transcription without ML infrastructure maintenance
   - **Usage:** Backend acts as orchestrator, managing API calls, polling, retries, and result caching

5. **Polling-Based Transcription**
   - **Why:** AssemblyAI processes asynchronously; polling ensures completion without webhooks
   - **Usage:** Upload audio → Get job ID → Poll every 3s → Return result when complete

6. **Stateless JWT Authentication**
   - **Why:** Scalable across multiple server instances, no session storage required
   - **Usage:** Token issued on login, validated on each request, supports horizontal scaling

7. **File Upload Streaming**
   - **Why:** Handles large audio files without loading entire file into memory
   - **Usage:** Stream directly to AI services, reducing server memory footprint

8. **Environment-Based Configuration**
   - **Why:** Separate dev/staging/production configs without code changes
   - **Usage:** Different MongoDB URIs, API keys, and CORS origins per environment

**Real-World Usage:**
- User uploads 10MB audio file → Streamed to backend → Uploaded to AssemblyAI → Job ID returned → Backend polls every 3s → Transcription complete → Result saved to MongoDB → OpenAI analyzes text → Final result returned to frontend
- Supports concurrent uploads with async processing
- Scales horizontally on Railway as traffic grows

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │React Frontend│   │ Mobile Apps  │   │  Third-party │     │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘     │
│         └──────────────────┼──────────────────┘             │
└────────────────────────────┼────────────────────────────────┘
                             │ HTTPS REST API
┌────────────────────────────┼────────────────────────────────┐
│               Railway Backend Server (Node.js)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Express.js API Layer                │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │   Routes    │  │  Middleware  │  │ Controllers │  │   │
│  │  │ (Endpoints) │→ │ (Auth/Valid) │→ │  (Business  │  │   │
│  │  │             │  │              │  │    Logic)   │  │   │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │   │
│  │                           │                          │   │
│  │  ┌────────────────────────┼─────────────────────────┐│   │
│  │  │                   Models Layer                   ││   │
│  │  │  • UserModel  • HistoryModel  • BillingModel     ││   │
│  │  │  • VerificationToken  • ResetToken               ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────────┐│   │
│  │  │              Utils & Helpers                     ││   │
│  │  │  • Email Service  • Helper Functions             ││   │
│  │  │  • FFmpeg Processor  • Token Generation          ││   │
│  │  └──────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐   ┌───────▼────────┐
│   MongoDB      │  │   AssemblyAI    │   │   OpenAI API   │
│  (Railway DB)  │  │  Transcription  │   │    (Whisper)   │
│                │  │      API        │   │                │
│ • Users        │  │ • Upload Audio  │   │ • Transcribe   │
│ • History      │  │ • Poll Status   │   │ • Analyze      │
│ • Billing      │  │ • Get Result    │   │                │
└────────────────┘  └─────────────────┘   └────────────────┘
```

### Backend Architecture

```
wavlang-backend/
├── config/
│   └── default.json        # JWT secrets, app config
│
├── models/                 # MongoDB Schemas (Mongoose)
│   ├── UserModel.js        # User authentication & profile
│   ├── HistoryModel.js     # Transcription history
│   ├── BillingModel.js     # Payment & subscription data
│   ├── VerificationToken.js# Email verification tokens
│   └── ResetToken.js       # Password reset tokens
│
├── controllers/            # Business logic & API handlers
│   ├── userController.js   # User CRUD, auth logic
│   ├── historyController.js# Transcription history
│   └── billingController.js# Billing operations
│
├── routes/                 # API endpoint definitions
│   ├── userRoutes.js       # /api/users, /api/auth
│   ├── userHistory.js      # /api/history
│   └── userBilling.js      # /api/billing
│
├── middleware/             # Express middleware
│   ├── user.js             # JWT authentication
│   └── validator.js        # Request validation
│
├── utils/                  # Helper functions
│   ├── helper.js           # Utility functions
│   └── mail.js             # Email sending service
│
├── server.js               # Main application entry point
├── package.json            # Dependencies & scripts
├── railway.json            # Railway deployment config
└── .env                    # Environment variables (gitignored)
```

### API Request Flow

1. **Authenticated Request Flow**
   ```
   Client Request → CORS Check → JWT Validation (middleware/user.js) → 
   Request Validator → Route Handler → Controller Logic → 
   Database Query → Response Formatter → JSON Response
   ```

2. **Audio Transcription Flow (AssemblyAI)**
   ```
   POST /api/transcribe_assemblyai
   ↓
   1. Receive multipart audio file (express-fileupload)
   2. Upload audio to AssemblyAI (axios POST)
   3. Get transcript job ID
   4. Poll AssemblyAI every 3 seconds
   5. Wait for status: 'completed'
   6. Return transcription result
   7. Save to MongoDB history (optional)
   ```

3. **User Registration Flow**
   ```
   POST /api/register
   ↓
   1. Validate input (express-validator)
   2. Hash password (bcrypt)
   3. Create user in MongoDB
   4. Generate verification token
   5. Send verification email (nodemailer)
   6. Return success response
   ```

4. **Authentication Flow**
   ```
   POST /api/login
   ↓
   1. Find user by email
   2. Compare password hash (bcrypt)
   3. Generate JWT token (jsonwebtoken)
   4. Set secure HTTP-only cookie
   5. Return user data + token
   
   Protected Routes:
   Request → Extract JWT → Verify signature → Decode payload → 
   Attach user to req.user → Continue to route handler
   ```

### Data Models

**User Schema:**
```javascript
{
  email: String (unique, required),
  password: String (hashed),
  name: String,
  googleId: String (for OAuth),
  verified: Boolean,
  createdAt: Date,
  credits: Number
}
```

**History Schema:**
```javascript
{
  userId: ObjectId (ref: User),
  audioFileName: String,
  transcription: String,
  analysis: Object,
  duration: Number,
  createdAt: Date
}
```

**Billing Schema:**
```javascript
{
  userId: ObjectId (ref: User),
  plan: String (free/pro/enterprise),
  usageMinutes: Number,
  lastPayment: Date,
  nextBillingDate: Date
}
```

### Key Design Patterns

- **MVC Architecture:** Separation of routes, controllers, and models
- **Middleware Chain:** Reusable authentication, validation, and error handling
- **Repository Pattern:** Mongoose models abstract database operations
- **Factory Pattern:** Token generation and email templates
- **Singleton Pattern:** Database connection and API clients
- **Strategy Pattern:** Multiple transcription providers (AssemblyAI, Whisper)
- **Proxy Pattern:** Backend proxies requests to external AI services
- **Observer Pattern:** Email notifications on transcription completion

---

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login (JWT)
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/logout` - User logout
- `POST /api/forgot-password` - Password reset request
- `POST /api/reset-password` - Reset password with token

### Transcription
- `POST /api/transcribe_assemblyai` - Transcribe audio using AssemblyAI
- `POST /api/transcribe_whisperai` - Transcribe audio using OpenAI Whisper
- `POST /api/transcribe_file` - Transcribe with time range trimming

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `DELETE /api/user/account` - Delete user account

### History & Billing
- `GET /api/history` - Get transcription history
- `GET /api/billing` - Get billing information
- `POST /api/billing/upgrade` - Upgrade subscription

---

## Installation & Development

### Prerequisites
- Node.js 14+ 
- MongoDB (local or cloud instance)
- API keys for AssemblyAI and OpenAI

### Local Development

```bash
# Clone the repository
git clone https://github.com/YourUsername/wavlang-backend.git
cd wavlang-backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials:
PORT=8080
MONGO_URI=mongodb://localhost:27017/WAVLANG
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000
ASSEMBLY_API_KEY=your_assemblyai_key
OPENAI_API_KEY=your_openai_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Start development server
npm run dev

# Or production mode
npm start
```

Server will run on `http://localhost:8080`

---

## Deployment to Railway

### Prerequisites
- GitHub repository
- Railway account
- Environment variables ready

### Quick Deploy

**Option 1: GitHub Integration (Recommended)**

1. Push code to GitHub
2. Go to [Railway.app](https://railway.app) and login
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your `wavlang-backend` repository
5. Add **MongoDB Plugin**: Click "New" → "Database" → "MongoDB"
6. Add environment variables (see below)
7. Railway auto-deploys on every push

**Option 2: Railway CLI**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Required Environment Variables

Set these in Railway dashboard under "Variables":

```bash
# Core
PORT=8080
MONGO_URI=${{MongoDB.MONGO_URI}}  # Auto-provided by Railway MongoDB plugin

# Authentication
JWT_SECRET=your_secure_jwt_secret_here

# CORS (Add your frontend domains)
FRONTEND_URL=https://wavlang-frontend-production.up.railway.app,http://localhost:3000

# API Keys
ASSEMBLY_API_KEY=your_assemblyai_api_key
OPENAI_API_KEY=your_openai_api_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=https://your-frontend-domain.com

# Email (if using email features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

**Note:** Railway automatically sets `PORT`, but you can override it.

### Post-Deployment

1. **Update Frontend** - Set `REACT_APP_API_URL` to your Railway backend URL
2. **Test Endpoints** - Use Postman or curl to verify API health
3. **Monitor Logs** - Check Railway logs for any startup issues
4. **Setup Domain** (Optional) - Add custom domain in Railway settings

---

## Security Features

- ✅ **Password Hashing** - bcrypt with salt rounds
- ✅ **JWT Authentication** - Secure, stateless tokens
- ✅ **CORS Protection** - Whitelist trusted origins
- ✅ **Environment Variables** - Secrets never in code
- ✅ **Input Validation** - express-validator sanitization
- ✅ **Rate Limiting** - Prevent abuse (recommended to add)
- ✅ **HTTPS Only** - Enforced in production

---

## Performance Optimizations

- **Streaming Uploads** - Large files don't block memory
- **Connection Pooling** - MongoDB connection reuse
- **Async/Await** - Non-blocking I/O operations
- **Polling Optimization** - 3-second intervals balance speed/cost
- **Compression** - Gzip responses (add middleware if needed)
- **Caching** - Consider Redis for frequent queries

---

## License

MIT License - See LICENSE file for details

---