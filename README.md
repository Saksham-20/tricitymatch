# TricityMatch - Matrimonial Platform

<p align="center">
  <img src="docs/logo.png" alt="TricityMatch Logo" width="200" />
</p>

<p align="center">
  A production-grade, secure, and scalable matrimonial platform for the Tricity area (Chandigarh, Mohali, Panchkula).
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api-reference">API</a>
</p>

---

## Features

### Core Features
- **Smart Compatibility Matching** - AI-powered algorithm calculating compatibility based on preferences, lifestyle, personality, and location
- **Real-time Chat** - Socket.io powered instant messaging for matched users
- **Identity Verification** - Aadhaar/PAN verification with admin approval workflow
- **Subscription System** - Free, Premium, and Elite plans with Razorpay integration
- **Advanced Search** - Filter by age, height, education, profession, lifestyle, and location
- **Privacy Controls** - Incognito mode, photo blur until match, contact visibility settings

### Production Features
- **Security Hardened** - JWT with refresh tokens, rate limiting, CSRF protection, input validation
- **Monitoring & Observability** - Prometheus metrics, health checks, structured logging
- **Performance Optimized** - Redis caching, background job processing, database indexing
- **Containerized** - Docker and Docker Compose for easy deployment
- **CI/CD Ready** - GitHub Actions workflows for testing and deployment

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Socket.io Client |
| **Backend** | Node.js 20, Express.js, Socket.io, JWT Auth |
| **Database** | PostgreSQL 15, Sequelize ORM |
| **Cache** | Redis 7 (with in-memory fallback) |
| **Queue** | Bull (Redis-based job processing) |
| **Payments** | Razorpay |
| **Storage** | Cloudinary (images), Local filesystem |
| **Monitoring** | Prometheus, Grafana, Custom metrics |
| **Deployment** | Docker, Docker Compose, Nginx |

---

## Quick Start

### Prerequisites
- **Docker** >= 20.10 and **Docker Compose** >= 2.0
- Or: **Node.js** >= 20, **PostgreSQL** >= 15, **Redis** >= 7 (optional)

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/tricitymatch.git
cd tricitymatch

# Copy environment template
cp .env.example .env

# Edit .env with your settings (minimum: DB_PASSWORD, JWT_SECRET)
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

**Access the application:**
- Frontend: http://localhost:3000
- API: http://localhost:5000/api
- API Docs: http://localhost:5000/api/docs
- Health Check: http://localhost:5000/monitoring/health

### Option 2: Manual Setup

```bash
# Backend
cd backend
npm install
cp ../.env.example ../.env.development
# Edit .env.development with your database credentials
npm run migrate
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment instructions |
| [API Documentation](http://localhost:5000/api/docs) | Interactive Swagger documentation |
| [Environment Configuration](.env.example) | All configuration options |

---

## Project Structure

```
TricityMatch/
├── backend/
│   ├── config/           # Database, environment, swagger config
│   ├── controllers/      # Request handlers
│   ├── docs/             # API documentation (YAML)
│   ├── middlewares/      # Auth, security, error handling
│   ├── migrations/       # Database migrations
│   ├── models/           # Sequelize models
│   ├── routes/           # API routes
│   ├── socket/           # WebSocket handlers
│   ├── tests/            # Unit and integration tests
│   ├── utils/            # Utilities (cache, queue, metrics, etc.)
│   ├── validators/       # Input validation schemas
│   └── server.js         # Application entry point
├── frontend/
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React contexts
│   │   ├── pages/        # Page components
│   │   └── utils/        # Frontend utilities
│   └── public/           # Static assets
├── monitoring/           # Prometheus, Grafana configs
├── nginx/                # Nginx reverse proxy config
├── scripts/              # Database init, deployment scripts
├── docker-compose.yml    # Container orchestration
└── .env.example          # Environment template
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login (sets httpOnly cookies) |
| POST | `/api/auth/logout` | Logout and revoke tokens |
| POST | `/api/auth/refresh-token` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile |
| GET | `/api/profile/:userId` | View another profile |
| POST | `/api/profile/photo` | Upload profile photo |

### Search & Match
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Search profiles with filters |
| GET | `/api/search/suggestions` | Get AI suggestions |
| POST | `/api/match/:userId` | Like/shortlist/pass |
| GET | `/api/match/matches` | Get mutual matches |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/:userId` | Get messages |
| POST | `/api/chat/send` | Send message |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/monitoring/health` | Basic health check |
| GET | `/monitoring/health/ready` | Kubernetes readiness |
| GET | `/monitoring/metrics` | Prometheus metrics |

Full API documentation available at `/api/docs` when running the server.

---

## Deployment

### Development
```bash
docker-compose up -d
```

### Production (with Nginx & Redis)
```bash
docker-compose --profile full up -d --build
```

### Production with Monitoring
```bash
docker-compose --profile full --profile monitoring up -d --build
```

### Cloud Deployment
See [Deployment Guide](docs/DEPLOYMENT.md) for:
- AWS ECS/Fargate deployment
- DigitalOcean deployment
- Kubernetes deployment
- SSL certificate setup
- Database backup strategies

---

## Monitoring

### Endpoints
- **Health Check**: `/monitoring/health/full`
- **Prometheus Metrics**: `/monitoring/metrics`
- **JSON Metrics**: `/monitoring/metrics/json`

### Dashboards (with monitoring profile)
- **Grafana**: http://localhost:3001 (admin / changeme)
- **Prometheus**: http://localhost:9090

### Metrics Collected
- HTTP request rates and latency (p50, p95, p99)
- Business metrics (signups, logins, matches, messages)
- Cache hit/miss ratios
- Background job queue stats
- Memory, CPU, and disk usage

---

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-random-secret` |
| `DB_PASSWORD` | PostgreSQL password | `secure-password` |
| `FRONTEND_URL` | Frontend URL for CORS | `https://tricitymatch.com` |

### Optional Services

| Service | Variables | Purpose |
|---------|-----------|---------|
| Redis | `REDIS_HOST`, `REDIS_PORT` | Caching, job queues |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Payments |
| Cloudinary | `CLOUDINARY_*` | Image storage |
| Email | `EMAIL_*` | Notifications |

See [.env.example](.env.example) for all options.

---

## Security Features

- **Authentication**: JWT with httpOnly cookies, refresh token rotation
- **Rate Limiting**: Per-IP and per-user rate limits
- **Input Validation**: Comprehensive validation with express-validator
- **SQL Injection**: Parameterized queries via Sequelize
- **XSS Protection**: Helmet security headers, input sanitization
- **CSRF Protection**: Token-based CSRF protection
- **Password Security**: Bcrypt hashing (12 rounds)
- **Account Security**: Login attempt limits, lockout mechanism

---

## Testing

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific tests
npm run test:unit
npm run test:integration
```

---

## Subscription Plans

| Feature | Free | Premium (₹2,999/mo) | Elite (₹4,999/mo) |
|---------|------|---------------------|-------------------|
| Basic Search | ✓ | ✓ | ✓ |
| Daily Likes | 10 | Unlimited | Unlimited |
| View Contacts | ✗ | ✓ | ✓ |
| Chat | ✗ | ✓ | ✓ |
| See Who Liked You | ✗ | ✓ | ✓ |
| Verified Badge | ✗ | ✗ | ✓ |
| Profile Boost | ✗ | ✗ | ✓ |
| Priority Support | ✗ | ✓ | ✓ |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style (ESLint configured)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

---

## Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

### Redis Not Available
The application gracefully falls back to in-memory cache if Redis is unavailable.

### Port Already in Use
```bash
# Change ports in .env
BACKEND_PORT=5001
FRONTEND_PORT=3001
```

### More Help
- Check [Deployment Guide](docs/DEPLOYMENT.md) troubleshooting section
- View application logs: `docker-compose logs -f backend`
- Health check: `curl http://localhost:5000/monitoring/health/full`

---

## License

ISC License - see [LICENSE](LICENSE) for details.

---

## Support

- **Documentation**: Check the `/docs` folder
- **Issues**: Open a GitHub issue
- **Email**: support@tricitymatch.com

---

<p align="center">
  <strong>Built with ❤️ for Tricity</strong>
</p>
