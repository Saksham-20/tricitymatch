# Tricity Match Frontend

A modern, elegant matrimonial website frontend built with React.js, Tailwind CSS, and Framer Motion. Designed specifically for the Tricity area (Chandigarh, Mohali, Panchkula).

## 🚀 Features

### ✨ Modern UI/UX
- **Warm & Welcoming Design**: Soft pastels, gradients, and elegant animations
- **Responsive Layout**: Mobile-first design that works on all devices
- **Smooth Animations**: Framer Motion for delightful user interactions
- **Custom Components**: Reusable UI components with consistent styling

### 🔐 Authentication
- **Multi-step Registration**: Progressive profile completion with personality questions
- **Secure Login**: JWT-based authentication with protected routes
- **Password Security**: Secure password handling with visibility toggles
- **Form Validation**: Real-time validation with helpful error messages

### 👤 Profile Management
- **Profile Creation**: Multi-step wizard for complete profile setup
- **Photo Upload**: Multiple photo upload with preview functionality
- **Identity Verification**: Document upload for profile verification
- **Profile Completion**: Progress tracking and completion percentage

### 💕 Matching & Discovery
- **Smart Matching**: AI-powered compatibility algorithm
- **Advanced Search**: Comprehensive filters for finding perfect matches
- **Browse Profiles**: Beautiful profile cards with hover effects
- **Compatibility Scores**: Visual compatibility indicators

### 💬 Real-time Chat
- **Socket.io Integration**: Real-time messaging for premium users
- **Typing Indicators**: Live typing status updates
- **Read Receipts**: Message read status tracking
- **File Sharing**: Support for image and document sharing

### 💎 Premium Features
- **Subscription Plans**: Free, Premium, and Elite tiers
- **Razorpay Integration**: Secure payment processing
- **Profile Boost**: Enhanced visibility for premium users
- **Advanced Analytics**: Detailed profile insights and statistics

### 🛡️ Admin Panel
- **User Management**: Comprehensive user administration
- **Analytics Dashboard**: Platform statistics and insights
- **Report Handling**: Safety and abuse report management
- **Verification Queue**: Identity verification management

## 🛠️ Tech Stack

- **React 18**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework with custom design system
- **Framer Motion**: Smooth animations and transitions
- **React Router**: Client-side routing with protected routes
- **Axios**: HTTP client with interceptors for API calls
- **Socket.io Client**: Real-time communication
- **React Hot Toast**: Beautiful toast notifications
- **Lucide React**: Modern icon library

## 📁 Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── api/               # API configuration and calls
│   │   ├── config.js      # Axios configuration
│   │   ├── auth.js        # Authentication API
│   │   ├── profile.js     # Profile management API
│   │   ├── matches.js     # Matching and search API
│   │   ├── subscription.js # Payment and subscription API
│   │   ├── admin.js       # Admin panel API
│   │   ├── insights.js    # Analytics and insights API
│   │   ├── notifications.js # Notifications API
│   │   └── boost.js       # Profile boost API
│   ├── components/        # Reusable UI components
│   │   ├── Layout/        # Layout components
│   │   │   ├── Navbar.jsx # Navigation bar
│   │   │   └── Layout.jsx # Main layout wrapper
│   │   ├── ProtectedRoute.jsx # Route protection
│   │   └── AdminRoute.jsx # Admin route protection
│   ├── context/           # React Context providers
│   │   ├── AuthContext.jsx # Authentication state
│   │   └── SocketContext.jsx # Socket.io connection
│   ├── pages/             # Page components
│   │   ├── LandingPage.jsx # Homepage
│   │   ├── Login.jsx      # Login page
│   │   ├── Signup.jsx     # Registration page
│   │   ├── Dashboard.jsx  # User dashboard
│   │   ├── Profile.jsx    # Profile view
│   │   ├── EditProfile.jsx # Profile editing
│   │   ├── Browse.jsx     # Profile browsing
│   │   ├── Search.jsx     # Advanced search
│   │   ├── Matches.jsx    # Matches and likes
│   │   ├── Chat.jsx       # Chat interface
│   │   ├── Pricing.jsx    # Pricing plans
│   │   ├── Subscription.jsx # Subscription management
│   │   ├── NotFound.jsx   # 404 page
│   │   └── admin/         # Admin panel pages
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # App entry point
│   └── index.css          # Global styles and Tailwind
├── .env.development       # Development environment variables
├── .env.production        # Production environment variables
├── .env.example           # Environment variables template
├── tailwind.config.js     # Tailwind configuration
├── postcss.config.js      # PostCSS configuration
├── vite.config.js         # Vite configuration
└── package.json           # Dependencies and scripts
```

## 🎨 Design System

### Color Palette
- **Primary**: Warm coral (#FF6B6B) - Main brand color
- **Secondary**: Soft purple (#9B59B6) - Accent color
- **Accent**: Warm peach (#FFB347) - Highlight color
- **Warm Peach**: (#FFE5D9) - Background gradient
- **Warm Cream**: (#FFF8F0) - Light background
- **Warm Lavender**: (#E0BBE4) - Soft accent

### Typography
- **Headings**: Poppins (Bold, Semi-bold)
- **Body**: Inter (Regular, Medium)
- **Sizes**: Responsive typography scale

### Components
- **Buttons**: Primary, Secondary, Outline variants
- **Cards**: Soft shadows with rounded corners
- **Forms**: Clean inputs with focus states
- **Animations**: Smooth transitions and hover effects

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Backend server running on port 5000
- PostgreSQL database with migrations applied

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TricityMatch/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.development
   # Edit .env.development with your configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🔧 Configuration

### Environment Variables

Create `.env.development` file:

```env
# API Configuration
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# Razorpay Configuration
VITE_RAZORPAY_KEY_ID=rzp_test_your_test_key_id_here

# App Configuration
VITE_APP_NAME=Tricity Match
VITE_APP_VERSION=1.0.0
```

### Tailwind Configuration

The project uses a custom Tailwind configuration with:
- Custom color palette
- Extended spacing and typography
- Custom animations and utilities
- Responsive breakpoints

## 📱 Responsive Design

The application is fully responsive with breakpoints:
- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

## 🎭 Animations

Framer Motion is used for:
- Page transitions
- Component entrance animations
- Hover effects
- Loading states
- Micro-interactions

## 🔒 Security Features

- JWT token management
- Protected routes
- Input validation
- XSS protection
- CSRF protection
- Secure API communication

## 🧪 Testing

The application includes:
- Component testing setup
- API integration testing
- User flow testing
- Responsive design testing

## 📦 Build & Deployment

### Production Build
```bash
npm run build
```

### Deployment Checklist
- [ ] Update environment variables
- [ ] Configure API endpoints
- [ ] Set up Razorpay keys
- [ ] Test all features
- [ ] Optimize images
- [ ] Enable compression
- [ ] Set up monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔮 Future Enhancements

- [ ] Progressive Web App (PWA) support
- [ ] Offline functionality
- [ ] Advanced filtering options
- [ ] Video profile support
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Advanced analytics
- [ ] AI-powered matching improvements

---

Built with ❤️ for the Tricity community
