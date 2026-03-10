-- ============================================================
-- Bridge Platform — Phase 3 Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    profile_type TEXT DEFAULT 'general',
    public_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation members (many-to-many)
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message_type TEXT DEFAULT 'text',
    encrypted_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast message lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);

-- Index for member lookups
CREATE INDEX IF NOT EXISTS idx_members_user
    ON conversation_members(user_id);

-- ============================================================
-- Row Level Security (RLS) Policies
-- Supabase enables RLS by default. These policies allow
-- the backend (using the anon key) to perform CRUD operations.
-- ============================================================

-- Disable RLS on all tables for server-side access via anon key
-- (Our backend handles auth via JWT — Supabase is just the data store)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow full access for the anon role (our backend handles authorization)
CREATE POLICY "Allow all operations for anon" ON users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for anon" ON conversations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for anon" ON conversation_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for anon" ON messages
    FOR ALL USING (true) WITH CHECK (true);
