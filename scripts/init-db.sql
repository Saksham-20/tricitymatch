-- TricityMatch Database Initialization Script
-- This script runs when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create indexes for better search performance (run after tables are created by Sequelize)
-- Note: Sequelize will create the tables; this is for additional optimizations

-- Grant permissions (for production with separate user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tricitymatch_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tricitymatch_user;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'TricityMatch database initialized at %', NOW();
END $$;
