# TricityMatch - Matrimonial Website

A complete, production-grade matrimonial website for the Tricity area (Chandigarh, Mohali, Panchkula) built with React.js, Node.js, and PostgreSQL.

## 🌟 Features

- **Smart Compatibility Matching**: AI-powered algorithm calculates compatibility based on preferences, lifestyle, personality, and location
- **Identity Verification**: Optional Aadhaar/PAN verification with admin approval
- **Real-time Chat**: Socket.io powered chat for premium users
- **Subscription System**: Free, Premium, and Elite plans with Razorpay integration
- **Advanced Search**: Filter by age, height, education, profession, lifestyle, and location
- **Profile Insights**: Engagement statistics and analytics dashboard
- **Modern UI/UX**: Beautiful, responsive design with Framer Motion animations
- **Privacy Controls**: Hide contact information until premium subscription

## 🛠️ Tech Stack

### Frontend
- React.js 18
- Vite
- Tailwind CSS
- Framer Motion
- Axios
- Socket.io Client
- React Router DOM

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- JWT Authentication
- Bcrypt Password Hashing
- Multer (File Uploads)
- Razorpay (Payments)
- Socket.io (Real-time Chat)
- Nodemailer (Email Notifications)

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TricityMatch
```

### 2. Backend Setup

```bash
cd backend
npm install
```

#### Database Configuration

1. Create a PostgreSQL database:
```sql
CREATE DATABASE matrimony_dev;
```

2. Configure environment variables:
   - Copy `.env.example` to `.env.development` and `.env.production`
   - Fill in your database credentials and other settings

#### Environment Variables (.env.development)

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=matrimony_dev

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters

# Razorpay (Get from Razorpay Dashboard)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Email (Optional for development)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@tricitymatch.com

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Admin
ADMIN_EMAIL=admin@tricitymatch.com
```

#### Run Database Migrations

```bash
npm run migrate
```

#### Start Backend Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

#### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

#### Start Frontend Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

### 4. Production Build

#### Frontend Build

```bash
cd frontend
npm run build
```

The production build will be in the `frontend/dist` directory.

#### Backend Production

1. Set `NODE_ENV=production` in `.env.production`
2. Update all production environment variables
3. Run migrations:
```bash
NODE_ENV=production npm run migrate
```
4. Start server:
```bash
NODE_ENV=production npm start
```

## 📁 Project Structure

```
TricityMatch/
├── backend/
│   ├── config/          # Database and app configuration
│   ├── controllers/     # Request handlers
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── middlewares/     # Auth, upload, error handling
│   ├── migrations/      # Database migrations
│   ├── utils/           # Utilities (compatibility, email, razorpay)
│   ├── socket/          # Socket.io handlers
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React contexts (Auth, Socket)
│   │   ├── api/         # API client
│   │   ├── utils/       # Utility functions
│   │   └── App.jsx      # Main app component
│   └── public/           # Static assets
├── .env.development     # Development environment variables
├── .env.production      # Production environment variables
└── README.md
```

## 🔐 Authentication

- JWT tokens stored in localStorage
- Protected routes require authentication
- Admin routes require admin role
- Password hashing with bcrypt (10 rounds)

## 💳 Subscription Plans

### Free
- Basic search
- Limited likes
- Profile viewing
- Compatibility scores

### Premium (₹2,999/month)
- Unlimited likes
- View contacts
- Chat with matches
- See who liked you
- Advanced search filters
- Priority support

### Elite (₹4,999/month)
- All Premium features
- Verified badge
- Profile boost
- Priority in search results
- Exclusive events
- Dedicated support

## 🔍 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Profile
- `GET /api/profile/me` - Get own profile
- `PUT /api/profile/me` - Update profile
- `GET /api/profile/me/stats` - Get engagement stats
- `GET /api/profile/:userId` - Get user profile

### Search
- `GET /api/search` - Search profiles with filters
- `GET /api/search/suggestions` - Get compatibility-based suggestions

### Matching
- `POST /api/match/:userId` - Like/shortlist/pass profile
- `GET /api/match/likes` - Get who liked you (premium)
- `GET /api/match/shortlist` - Get shortlisted profiles
- `GET /api/match/mutual` - Get mutual matches

### Chat
- `GET /api/chat/conversations` - Get all conversations
- `GET /api/chat/messages/:userId` - Get messages with user
- `POST /api/chat/messages` - Send message

### Subscription
- `GET /api/subscription/plans` - Get available plans
- `GET /api/subscription/my-subscription` - Get current subscription
- `POST /api/subscription/create-order` - Create Razorpay order
- `POST /api/subscription/verify-payment` - Verify payment

## 🎨 Using Environment Files

The application uses separate environment files for development and production. The backend automatically loads the correct file based on the `NODE_ENV` environment variable.

### Development Environment

1. Copy `.env.example` to `.env.development`
2. Fill in development values:
   - Local PostgreSQL database credentials
   - Razorpay test keys (from Razorpay Dashboard → Settings → API Keys → Test Mode)
   - Email configuration (optional for development)
   - JWT secret (can be any string for development, but use a strong one in production)
3. Run the backend with:
   ```bash
   NODE_ENV=development npm run dev
   ```
   Or simply `npm run dev` (defaults to development)

### Production Environment

1. Copy `.env.example` to `.env.production`
2. Fill in production values:
   - Production PostgreSQL database with SSL enabled
   - Razorpay live keys (from Razorpay Dashboard → Settings → API Keys → Live Mode)
   - Production email SMTP credentials
   - **Strong JWT secret** (generate using: `openssl rand -base64 32`)
   - Production frontend URL
3. Run the backend with:
   ```bash
   NODE_ENV=production npm start
   ```

### How It Works

- The backend's `server.js` and `config/config.js` automatically load `.env.development` or `.env.production` based on `NODE_ENV`
- Frontend uses a single `.env` file (or environment variables) for Vite
- **Important**: Never commit `.env.development` or `.env.production` to version control. Only commit `.env.example`

## 🔧 Configuration

### Database Connection

The app automatically uses the correct environment file based on `NODE_ENV`:
- `development` → `.env.development`
- `production` → `.env.production`

### Razorpay Setup

1. Sign up at [Razorpay](https://razorpay.com)
2. Get API keys from Dashboard → Settings → API Keys
3. Use test keys for development
4. Use live keys for production

### Email Configuration

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the app password in `EMAIL_PASSWORD`

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check database credentials in `.env.development`
- Verify database exists: `psql -U postgres -l`

### Port Already in Use
- Change `PORT` in `.env.development`
- Or kill the process using the port

### File Upload Issues
- Ensure `uploads/` directory exists
- Check file size limits (5MB default)
- Verify Multer configuration

### Socket.io Connection Issues
- Check CORS configuration
- Verify JWT token in localStorage
- Ensure premium subscription for chat

## 📝 License

ISC

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for Tricity**

