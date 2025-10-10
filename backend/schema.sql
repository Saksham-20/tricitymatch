-- Tricity Match Database Schema
-- PostgreSQL Database Schema for Matrimonial Website

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE subscription_type AS ENUM ('free', 'premium', 'elite');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE skin_tone_type AS ENUM ('fair', 'wheatish', 'dark', 'very fair');
CREATE TYPE diet_type AS ENUM ('vegetarian', 'non-vegetarian', 'vegan', 'jain');
CREATE TYPE habit_type AS ENUM ('yes', 'no', 'occasionally');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_plan AS ENUM ('premium', 'elite', 'boost');
CREATE TYPE report_reason AS ENUM ('fake_profile', 'inappropriate_behavior', 'harassment', 'spam', 'underage', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
CREATE TYPE notification_type AS ENUM ('profile_view', 'like', 'message', 'match', 'reminder', 'subscription_expiry', 'boost_expiry', 'verification_approved', 'verification_rejected', 'admin_message');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file');
CREATE TYPE preference_choice AS ENUM ('vegetarian', 'non-vegetarian', 'vegan', 'jain', 'any');
CREATE TYPE habit_choice AS ENUM ('yes', 'no', 'occasionally', 'any');

-- Users table
CREATE TABLE Users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    role user_role DEFAULT 'user' NOT NULL,
    is_verified BOOLEAN DEFAULT false NOT NULL,
    is_email_verified BOOLEAN DEFAULT false NOT NULL,
    subscription_type subscription_type DEFAULT 'free' NOT NULL,
    subscription_expiry TIMESTAMP,
    boost_expiry TIMESTAMP,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_login TIMESTAMP,
    ban_reason TEXT,
    ban_expiry TIMESTAMP,
    banned_by UUID REFERENCES Users(id) ON DELETE SET NULL,
    banned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Profiles table
CREATE TABLE Profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    gender gender_type NOT NULL,
    dob DATE NOT NULL,
    height INTEGER CHECK (height >= 120 AND height <= 220),
    weight INTEGER CHECK (weight >= 30 AND weight <= 200),
    religion VARCHAR(50),
    caste VARCHAR(50),
    community VARCHAR(50),
    skin_tone skin_tone_type,
    diet diet_type,
    smoking habit_type,
    drinking habit_type,
    education VARCHAR(100),
    profession VARCHAR(100),
    income INTEGER CHECK (income >= 0),
    city VARCHAR(50),
    bio TEXT CHECK (LENGTH(bio) <= 500),
    photos JSONB DEFAULT '[]' NOT NULL,
    personality_answers JSONB DEFAULT '{}' NOT NULL,
    verification_status verification_status DEFAULT 'pending' NOT NULL,
    verification_docs JSONB DEFAULT '{}' NOT NULL,
    verification_notes TEXT,
    birth_time TIME,
    birth_place VARCHAR(100),
    kundli_data JSONB DEFAULT '{}' NOT NULL,
    is_profile_complete BOOLEAN DEFAULT false NOT NULL,
    profile_completion_percentage INTEGER DEFAULT 0 CHECK (profile_completion_percentage >= 0 AND profile_completion_percentage <= 100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Preferences table
CREATE TABLE Preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    age_min INTEGER CHECK (age_min >= 18 AND age_min <= 80),
    age_max INTEGER CHECK (age_max >= 18 AND age_max <= 80),
    height_min INTEGER CHECK (height_min >= 120 AND height_min <= 220),
    height_max INTEGER CHECK (height_max >= 120 AND height_max <= 220),
    religion VARCHAR(50),
    caste VARCHAR(50),
    education VARCHAR(100),
    profession VARCHAR(100),
    income_min INTEGER CHECK (income_min >= 0),
    income_max INTEGER CHECK (income_max >= 0),
    city VARCHAR(50),
    diet preference_choice,
    smoking habit_choice,
    drinking habit_choice,
    kundli_match BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Likes table
CREATE TABLE Likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    liked_user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    is_mutual BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, liked_user_id)
);

-- Shortlists table
CREATE TABLE Shortlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    shortlisted_user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, shortlisted_user_id)
);

-- Chats table
CREATE TABLE Chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type message_type DEFAULT 'text' NOT NULL,
    attachment_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false NOT NULL,
    read_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Payments table
CREATE TABLE Payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    payment_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    status payment_status DEFAULT 'pending' NOT NULL,
    plan payment_plan NOT NULL,
    plan_duration INTEGER NOT NULL,
    razorpay_signature TEXT,
    failure_reason TEXT,
    refund_amount INTEGER,
    refund_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Reports table
CREATE TABLE Reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    description TEXT,
    status report_status DEFAULT 'pending' NOT NULL,
    admin_notes TEXT,
    resolved_by UUID REFERENCES Users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ProfileViews table
CREATE TABLE ProfileViews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    viewed_user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    is_revealed BOOLEAN DEFAULT false NOT NULL,
    view_count INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(viewer_id, viewed_user_id)
);

-- Notifications table
CREATE TABLE Notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}' NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    read_at TIMESTAMP,
    is_email_sent BOOLEAN DEFAULT false NOT NULL,
    is_sms_sent BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ProfileBoosts table
CREATE TABLE ProfileBoosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    boost_start_time TIMESTAMP NOT NULL,
    boost_end_time TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    payment_id UUID REFERENCES Payments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON Users(email);
CREATE INDEX idx_users_role ON Users(role);
CREATE INDEX idx_users_subscription_type ON Users(subscription_type);
CREATE INDEX idx_users_is_active ON Users(is_active);
CREATE INDEX idx_users_created_at ON Users(created_at);

CREATE INDEX idx_profiles_user_id ON Profiles(user_id);
CREATE INDEX idx_profiles_gender ON Profiles(gender);
CREATE INDEX idx_profiles_religion ON Profiles(religion);
CREATE INDEX idx_profiles_caste ON Profiles(caste);
CREATE INDEX idx_profiles_city ON Profiles(city);
CREATE INDEX idx_profiles_verification_status ON Profiles(verification_status);
CREATE INDEX idx_profiles_is_profile_complete ON Profiles(is_profile_complete);

CREATE INDEX idx_preferences_user_id ON Preferences(user_id);

CREATE INDEX idx_likes_user_id ON Likes(user_id);
CREATE INDEX idx_likes_liked_user_id ON Likes(liked_user_id);
CREATE INDEX idx_likes_is_mutual ON Likes(is_mutual);
CREATE INDEX idx_likes_created_at ON Likes(created_at);

CREATE INDEX idx_shortlists_user_id ON Shortlists(user_id);
CREATE INDEX idx_shortlists_shortlisted_user_id ON Shortlists(shortlisted_user_id);
CREATE INDEX idx_shortlists_created_at ON Shortlists(created_at);

CREATE INDEX idx_chats_sender_receiver_created ON Chats(sender_id, receiver_id, created_at);
CREATE INDEX idx_chats_receiver_is_read ON Chats(receiver_id, is_read);
CREATE INDEX idx_chats_sender_id ON Chats(sender_id);
CREATE INDEX idx_chats_receiver_id ON Chats(receiver_id);
CREATE INDEX idx_chats_created_at ON Chats(created_at);

CREATE INDEX idx_payments_user_id ON Payments(user_id);
CREATE INDEX idx_payments_order_id ON Payments(order_id);
CREATE INDEX idx_payments_payment_id ON Payments(payment_id);
CREATE INDEX idx_payments_status ON Payments(status);
CREATE INDEX idx_payments_plan ON Payments(plan);
CREATE INDEX idx_payments_created_at ON Payments(created_at);

CREATE INDEX idx_reports_reported_user_id ON Reports(reported_user_id);
CREATE INDEX idx_reports_reporter_id ON Reports(reporter_id);
CREATE INDEX idx_reports_status ON Reports(status);
CREATE INDEX idx_reports_reason ON Reports(reason);
CREATE INDEX idx_reports_resolved_by ON Reports(resolved_by);
CREATE INDEX idx_reports_created_at ON Reports(created_at);

CREATE INDEX idx_profile_views_viewed_user_id ON ProfileViews(viewed_user_id);
CREATE INDEX idx_profile_views_viewer_id ON ProfileViews(viewer_id);
CREATE INDEX idx_profile_views_created_at ON ProfileViews(created_at);

CREATE INDEX idx_notifications_user_id ON Notifications(user_id);
CREATE INDEX idx_notifications_type ON Notifications(type);
CREATE INDEX idx_notifications_is_read ON Notifications(is_read);
CREATE INDEX idx_notifications_created_at ON Notifications(created_at);

CREATE INDEX idx_profile_boosts_user_id ON ProfileBoosts(user_id);
CREATE INDEX idx_profile_boosts_is_active ON ProfileBoosts(is_active);
CREATE INDEX idx_profile_boosts_boost_times ON ProfileBoosts(boost_start_time, boost_end_time);
CREATE INDEX idx_profile_boosts_payment_id ON ProfileBoosts(payment_id);
CREATE INDEX idx_profile_boosts_created_at ON ProfileBoosts(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON Users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON Profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON Preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_likes_updated_at BEFORE UPDATE ON Likes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shortlists_updated_at BEFORE UPDATE ON Shortlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON Chats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON Payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON Reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_views_updated_at BEFORE UPDATE ON ProfileViews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON Notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_boosts_updated_at BEFORE UPDATE ON ProfileBoosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE VIEW user_profiles AS
SELECT 
    u.id,
    u.email,
    u.phone,
    u.role,
    u.is_verified,
    u.subscription_type,
    u.subscription_expiry,
    u.is_active,
    u.created_at,
    p.name,
    p.gender,
    p.dob,
    p.height,
    p.weight,
    p.religion,
    p.caste,
    p.city,
    p.profession,
    p.verification_status,
    p.is_profile_complete,
    p.profile_completion_percentage
FROM Users u
LEFT JOIN Profiles p ON u.id = p.user_id;

CREATE VIEW active_subscriptions AS
SELECT 
    u.id,
    u.email,
    u.subscription_type,
    u.subscription_expiry,
    CASE 
        WHEN u.subscription_expiry > CURRENT_TIMESTAMP THEN true 
        ELSE false 
    END as is_active
FROM Users u
WHERE u.subscription_type != 'free';

CREATE VIEW profile_stats AS
SELECT 
    p.user_id,
    p.name,
    COUNT(DISTINCT pv.id) as total_views,
    COUNT(DISTINCT l.id) as total_likes_received,
    COUNT(DISTINCT s.id) as total_shortlists_received,
    p.profile_completion_percentage
FROM Profiles p
LEFT JOIN ProfileViews pv ON p.user_id = pv.viewed_user_id
LEFT JOIN Likes l ON p.user_id = l.liked_user_id
LEFT JOIN Shortlists s ON p.user_id = s.shortlisted_user_id
GROUP BY p.user_id, p.name, p.profile_completion_percentage;

-- Insert sample data (optional - for testing)
-- This would typically be done through seeders in development

COMMENT ON TABLE Users IS 'Main users table storing authentication and subscription information';
COMMENT ON TABLE Profiles IS 'User profile information including personal details and photos';
COMMENT ON TABLE Preferences IS 'User preferences for partner matching';
COMMENT ON TABLE Likes IS 'User likes and mutual matches';
COMMENT ON TABLE Shortlists IS 'User shortlisted profiles';
COMMENT ON TABLE Chats IS 'Real-time chat messages between users';
COMMENT ON TABLE Payments IS 'Payment records for subscriptions and boosts';
COMMENT ON TABLE Reports IS 'User reports and moderation';
COMMENT ON TABLE ProfileViews IS 'Profile view tracking for analytics';
COMMENT ON TABLE Notifications IS 'User notifications and alerts';
COMMENT ON TABLE ProfileBoosts IS 'Paid profile boost records';
