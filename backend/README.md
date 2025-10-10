# Tricity Match Backend API

A comprehensive matrimonial website backend built with Node.js, Express.js, and PostgreSQL for the Tricity area (Chandigarh, Mohali, Panchkula).

## 🚀 Features

### Core Features
- **User Authentication**: JWT-based authentication with bcrypt password hashing
- **Profile Management**: Multi-step profile completion with photo uploads
- **Smart Matching**: AI-powered compatibility algorithm with personality matching
- **Real-time Chat**: Socket.io integration for premium users
- **Payment Integration**: Razorpay integration for subscriptions and profile boosts
- **Admin Dashboard**: Complete admin panel for user management and analytics

### Advanced Features
- **Identity Verification**: Optional verification with admin approval
- **Profile Boost**: Paid feature for top listing in search results
- **Engagement Analytics**: Detailed insights and performance metrics
- **Kundli Matching**: Astrology-based compatibility calculation
- **Smart Notifications**: Email and in-app notifications
- **Profile View Tracking**: Premium feature to see who viewed your profile

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT + bcrypt
- **File Uploads**: Multer
- **Real-time**: Socket.io
- **Payments**: Razorpay
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express-validator

## 📁 Project Structure

```
backend/
├── config/
│   ├── config.js          # Application configuration
│   ├── database.js        # Database configuration
│   └── sequelize.js       # Sequelize connection
├── controllers/
│   ├── authController.js      # Authentication logic
│   ├── profileController.js   # Profile management
│   ├── matchController.js     # Matching and discovery
│   ├── subscriptionController.js # Payments and subscriptions
│   ├── adminController.js     # Admin dashboard
│   ├── insightController.js   # Analytics and insights
│   ├── notificationController.js # Notifications
│   └── boostController.js     # Profile boost
├── middlewares/
│   ├── authMiddleware.js      # JWT authentication
│   ├── errorHandler.js        # Error handling
│   └── rateLimiter.js         # Rate limiting
├── models/
│   ├── User.js               # User model
│   ├── Profile.js            # Profile model
│   ├── Preference.js         # Preferences model
│   ├── Like.js               # Likes model
│   ├── Shortlist.js          # Shortlists model
│   ├── Chat.js               # Chat model
│   ├── Payment.js            # Payment model
│   ├── Report.js             # Report model
│   ├── ProfileView.js        # Profile views model
│   ├── Notification.js       # Notifications model
│   ├── ProfileBoost.js       # Profile boost model
│   └── index.js              # Model associations
├── routes/
│   ├── authRoutes.js         # Authentication routes
│   ├── profileRoutes.js      # Profile routes
│   ├── matchRoutes.js        # Matching routes
│   ├── subscriptionRoutes.js # Subscription routes
│   ├── adminRoutes.js        # Admin routes
│   ├── insightRoutes.js      # Insights routes
│   ├── notificationRoutes.js # Notification routes
│   └── boostRoutes.js        # Boost routes
├── utils/
│   ├── compatibility.js      # Compatibility algorithm
│   ├── socketHandler.js      # Socket.io handlers
│   └── emailService.js       # Email service
├── migrations/               # Database migrations
├── seeders/                  # Database seeders
├── uploads/                  # File uploads directory
├── server.js                 # Main server file
├── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TricityMatch/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env.development
   ```
   
   Update the `.env.development` file with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=matrimony_dev
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRE=7d

   # Razorpay Configuration
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_secret

   # Other configurations...
   ```

4. **Database Setup**
   ```bash
   # Create database
   createdb matrimony_dev

   # Run migrations
   npm run migrate

   # Seed sample data
   npm run seed
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

The server will start on `http://localhost:5000`

## 📊 Database Schema

### Core Tables
- **Users**: Authentication and subscription data
- **Profiles**: Personal information and photos
- **Preferences**: Partner matching preferences
- **Likes**: User likes and mutual matches
- **Shortlists**: Saved profiles
- **Chats**: Real-time messages
- **Payments**: Subscription and boost payments
- **Reports**: User reports and moderation
- **ProfileViews**: Profile view tracking
- **Notifications**: User notifications
- **ProfileBoosts**: Paid profile boosts

### Key Relationships
- One-to-One: User ↔ Profile, User ↔ Preference
- One-to-Many: User → Likes, User → Chats, User → Payments
- Many-to-Many: Users ↔ Users (through Likes, Shortlists, Chats)

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password

### Profile Management
- `GET /api/profile/me` - Get own profile
- `PUT /api/profile/update` - Update profile
- `POST /api/profile/upload-photo` - Upload photo
- `DELETE /api/profile/photo/:id` - Delete photo
- `POST /api/profile/verify-identity` - Upload verification docs
- `GET /api/profile/:id` - View other profile
- `GET /api/profile/completion` - Get completion status
- `PUT /api/profile/preferences` - Update preferences

### Matching & Discovery
- `GET /api/matches/suggestions` - Get suggested matches
- `GET /api/matches/search` - Search profiles with filters
- `POST /api/matches/like` - Like a profile
- `POST /api/matches/shortlist` - Shortlist a profile
- `GET /api/matches/liked-by` - See who liked you (premium)
- `GET /api/matches/my-likes` - Get your likes
- `GET /api/matches/shortlists` - Get shortlists
- `POST /api/matches/kundli-match` - Calculate Kundli compatibility

### Subscriptions & Payments
- `POST /api/subscription/create-order` - Create Razorpay order
- `POST /api/subscription/verify-payment` - Verify payment
- `GET /api/subscription/status` - Get subscription status
- `GET /api/subscription/payment-history` - Get payment history
- `POST /api/subscription/cancel` - Cancel subscription
- `POST /api/subscription/boost/create-order` - Create boost order
- `POST /api/subscription/boost/verify-payment` - Verify boost payment

### Admin Dashboard
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/verify` - Verify user identity
- `PUT /api/admin/users/:id/ban` - Ban/unban user
- `GET /api/admin/reports` - List reports
- `PUT /api/admin/reports/:id/resolve` - Resolve report
- `GET /api/admin/analytics` - Get analytics
- `GET /api/admin/dashboard` - Dashboard stats
- `POST /api/admin/notifications/send` - Send notification
- `GET /api/admin/verification-queue` - Get verification queue

### Insights & Analytics
- `GET /api/insights/profile-views` - Get profile views (premium)
- `GET /api/insights/stats` - Get personal stats
- `GET /api/insights/engagement` - Get engagement insights
- `GET /api/insights/compatibility` - Get compatibility insights
- `GET /api/insights/performance` - Get profile performance

### Notifications
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Profile Boost
- `GET /api/boost/status` - Get boost status
- `GET /api/boost/history` - Get boost history
- `GET /api/boost/active` - Get active boosts

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## 💳 Payment Integration

### Razorpay Configuration
1. Create a Razorpay account
2. Get your API keys from the dashboard
3. Add keys to environment variables
4. Test with Razorpay test keys in development

### Subscription Plans
- **Free**: Limited features, 10 profile views/day
- **Premium** (₹999/month): Unlimited browsing, chat, see who liked you
- **Elite** (₹2499/month): All premium features + verification badge + priority listing

### Profile Boost
- **24 hours**: ₹1200
- **72 hours**: ₹3000
- **168 hours**: ₹6000

## 🧠 Smart Matching Algorithm

The compatibility algorithm considers:
- **Personality Answers** (40%): Values, lifestyle, hobbies
- **Preferences Match** (30%): Age, height, religion, education
- **Lifestyle Compatibility** (20%): Diet, smoking, drinking habits
- **Location Proximity** (10%): Tricity area and nearby cities

## 🔒 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Prevents abuse and DDoS
- **Input Validation**: Express-validator for all inputs
- **File Upload Security**: Type and size restrictions
- **CORS Configuration**: Environment-specific origins
- **Helmet**: Security headers
- **SQL Injection Protection**: Sequelize ORM

## 📈 Analytics & Insights

### User Analytics
- Profile views and engagement
- Match success rates
- Subscription conversion
- Geographic distribution

### Admin Analytics
- User growth and retention
- Revenue tracking
- Report analysis
- System performance

## 🚀 Deployment

### Environment Variables
Set up production environment variables:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PASSWORD=your-secure-password
JWT_SECRET=your-production-secret
RAZORPAY_KEY_ID=rzp_live_your_live_key
RAZORPAY_KEY_SECRET=your_live_secret
```

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use production database with SSL
- [ ] Configure live Razorpay keys
- [ ] Set up proper CORS origins
- [ ] Enable compression and security headers
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📝 API Documentation

For detailed API documentation, visit `/api-docs` when the server is running, or check the individual route files for parameter specifications.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Built with ❤️ for the Tricity community**
