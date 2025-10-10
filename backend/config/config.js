require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const config = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  },
  
  // Razorpay Configuration
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880, // 5MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  
  // SMS Configuration
  sms: {
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID || 'TRICITY'
  },
  
  // Admin Configuration
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@tricitymatch.com',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  },
  
  // Socket.io Configuration
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000'
  },
  
  // Subscription Plans
  subscriptionPlans: {
    free: {
      name: 'Free',
      price: 0,
      features: ['Create profile', 'Browse 10 profiles/day', 'See 5 matches'],
      limits: {
        dailyViews: 10,
        matches: 5,
        chat: false
      }
    },
    premium: {
      name: 'Premium',
      price: 999,
      features: ['Everything in Free', 'Unlimited browsing', 'Chat with matches', 'See who liked you'],
      limits: {
        dailyViews: -1, // unlimited
        matches: -1, // unlimited
        chat: true
      }
    },
    elite: {
      name: 'Elite',
      price: 2499,
      features: ['Everything in Premium', 'Profile verification badge', 'Top listing', 'Advanced analytics'],
      limits: {
        dailyViews: -1,
        matches: -1,
        chat: true,
        priority: true,
        verified: true
      }
    }
  }
};

module.exports = config;
