-- ============================================
-- Online Voting System - MySQL Database Schema
-- ============================================
-- This file contains all CREATE TABLE statements,
-- constraints, sample data, and useful SQL queries.

-- Create the database
CREATE DATABASE IF NOT EXISTS online_voting_system;
USE online_voting_system;

-- ============================================
-- TABLE: admins
-- Stores admin login credentials (no registration)
-- ============================================
CREATE TABLE admins (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- stored as bcrypt hash
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TABLE: users (Voters)
-- Registered voters who can vote for candidates
-- ============================================
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- stored as bcrypt hash
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TABLE: candidates
-- People who register as candidates for election
-- ============================================
CREATE TABLE candidates (
    candidate_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,  -- stored as bcrypt hash
    description TEXT,
    is_approved TINYINT(1) DEFAULT 0,  -- 0 = pending, 1 = approved, 2 = rejected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- TABLE: votes
-- Records each vote; UNIQUE constraint on user_id
-- ensures one vote per user
-- ============================================
CREATE TABLE votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    candidate_id INT NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key to users table
    FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    -- Foreign key to candidates table
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    -- UNIQUE constraint: each user can vote only once
    UNIQUE KEY unique_vote_per_user (user_id)
) ENGINE=InnoDB;

-- ============================================
-- TABLE: settings
-- Stores voting period (start/end dates)
-- Only one row expected (id = 1)
-- ============================================
CREATE TABLE settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    voting_start_date DATETIME NOT NULL,
    voting_end_date DATETIME NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- INSERT SAMPLE DATA
-- ============================================

-- Admin account (password: "admin123" - bcrypt hash)
-- In production, generate this hash properly
INSERT INTO admins (username, password) VALUES
('admin', '$2b$10$YourBcryptHashHere1234567890abcdefghijklmnopqrst');
-- NOTE: The backend seeds this properly on first run. This is a placeholder.
-- UPDATE admins SET password = '$2b$10$1LdqHj8OW12QdfHv1zyTL.QjsRfdtiQHooou8HSTlqmHg7tbygJMu' WHERE username = 'admin';
-- Sample users/voters (passwords will be hashed by backend)
-- These are placeholders; register through the app for real hashed passwords.

-- Sample voting period settings
INSERT INTO settings (voting_start_date, voting_end_date) VALUES
('2025-01-01 00:00:00', '2025-12-31 23:59:59');

-- ============================================
-- USEFUL SQL QUERIES
-- ============================================

-- 1. Fetch all approved candidates
-- SELECT candidate_id, full_name, description
-- FROM candidates
-- WHERE is_approved = 1;

-- 2. Insert a vote (will fail if user already voted due to UNIQUE constraint)
-- INSERT INTO votes (user_id, candidate_id) VALUES (?, ?);

-- 3. Count votes per candidate using GROUP BY
-- SELECT c.candidate_id, c.full_name, COUNT(v.vote_id) AS total_votes
-- FROM candidates c
-- LEFT JOIN votes v ON c.candidate_id = v.candidate_id
-- WHERE c.is_approved = 1
-- GROUP BY c.candidate_id, c.full_name
-- ORDER BY total_votes DESC;

-- 4. Find the candidate with the highest votes (winner)
-- SELECT c.candidate_id, c.full_name, COUNT(v.vote_id) AS total_votes
-- FROM candidates c
-- LEFT JOIN votes v ON c.candidate_id = v.candidate_id
-- WHERE c.is_approved = 1
-- GROUP BY c.candidate_id, c.full_name
-- ORDER BY total_votes DESC
-- LIMIT 1;

-- 5. Check if a user has already voted
-- SELECT COUNT(*) AS has_voted FROM votes WHERE user_id = ?;

-- 6. Extend voting expiry date (admin action)
-- UPDATE settings SET voting_end_date = ? WHERE setting_id = 1;

-- 7. Get voting period settings
-- SELECT voting_start_date, voting_end_date FROM settings WHERE setting_id = 1;

-- 8. Approve a candidate
-- UPDATE candidates SET is_approved = 1 WHERE candidate_id = ?;

-- 9. Reject a candidate
-- UPDATE candidates SET is_approved = 2 WHERE candidate_id = ?;

-- 10. Get all users
-- SELECT user_id, full_name, email, created_at FROM users;
