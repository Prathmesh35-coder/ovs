// ============================================
// Online Voting System - Express Backend Server
// ============================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));
// ============================================
// DATABASE CONNECTION
// ============================================
// Update these credentials to match your MySQL setup
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
};
let db;

async function initDatabase() {
    try {
        // First connect without database to create it if needed
        const tempDb = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        await tempDb.execute('CREATE DATABASE IF NOT EXISTS online_voting_system');
        await tempDb.end();

        // Now connect to the database
        db = await mysql.createPool(dbConfig);

        // Create tables if they don't exist
        await db.execute(`
            CREATE TABLE IF NOT EXISTS admins (
                admin_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS candidates (
                candidate_id INT AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                description TEXT,
                is_approved TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS votes (
                vote_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                candidate_id INT NOT NULL,
                voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                UNIQUE KEY unique_vote_per_user (user_id)
            ) ENGINE=InnoDB
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                setting_id INT AUTO_INCREMENT PRIMARY KEY,
                voting_start_date DATETIME NOT NULL,
                voting_end_date DATETIME NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        // Seed admin account if not exists
        const [admins] = await db.execute('SELECT * FROM admins WHERE username = ?', ['admin']);
        if (admins.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.execute('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
            console.log('Default admin created (username: admin, password: admin123)');
        }

        // Seed settings if not exists
        const [settings] = await db.execute('SELECT * FROM settings');
        if (settings.length === 0) {
            await db.execute(
                'INSERT INTO settings (voting_start_date, voting_end_date) VALUES (?, ?)',
                ['2025-01-01 00:00:00', '2025-12-31 23:59:59']
            );
            console.log('Default voting period set (2025)');
        }

        console.log('Database initialized successfully!');
    } catch (error) {
        console.error('Database initialization error:', error.message);
        process.exit(1);
    }
}

// ============================================
// HELPER: Check if voting is open
// ============================================
async function isVotingOpen() {
    const [rows] = await db.execute('SELECT voting_start_date, voting_end_date FROM settings WHERE setting_id = 1');
    if (rows.length === 0) return false;
    const now = new Date();
    return now >= new Date(rows[0].voting_start_date) && now <= new Date(rows[0].voting_end_date);
}

// ============================================
// MIDDLEWARE: Auth checks
// ============================================
function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') return next();
    res.status(401).json({ error: 'Admin access required' });
}

function requireUser(req, res, next) {
    if (req.session && req.session.role === 'user') return next();
    res.status(401).json({ error: 'User access required' });
}

function requireCandidate(req, res, next) {
    if (req.session && req.session.role === 'candidate') return next();
    res.status(401).json({ error: 'Candidate access required' });
}

// ============================================
// ROUTES: Page Serving
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ============================================
// ROUTES: Authentication
// ============================================

// --- Admin Login ---
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const admin = rows[0];
        const valid = await bcrypt.compare(password, admin.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Store admin info in session
        req.session.userId = rows[0].admin_id;
        req.session.role = 'admin';
        req.session.username = rows[0].username;

        res.json({ message: 'Admin login successful', redirect: '/admin-dashboard.html' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// --- User Registration ---
app.post('/api/user/register', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        // Check if email already exists
        const [existing] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)',
            [full_name, email, hashedPassword]
        );

        res.json({ message: 'Registration successful! Please login.' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// --- User Login ---
app.post('/api/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = rows[0].user_id;
        req.session.role = 'user';
        req.session.userName = rows[0].full_name;

        res.json({ message: 'Login successful', redirect: '/user-dashboard.html' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// --- Candidate Registration ---
app.post('/api/candidate/register', async (req, res) => {
    try {
        const { full_name, email, password, description } = req.body;

        const [existing] = await db.execute('SELECT * FROM candidates WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO candidates (full_name, email, password, description) VALUES (?, ?, ?, ?)',
            [full_name, email, hashedPassword, description]
        );

        res.json({ message: 'Candidate registration successful! Wait for admin approval. You can login to view results.' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// --- Candidate Login ---
app.post('/api/candidate/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await db.execute('SELECT * FROM candidates WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = rows[0].candidate_id;
        req.session.role = 'candidate';
        req.session.candidateName = rows[0].full_name;

        res.json({ message: 'Login successful', redirect: '/candidate-dashboard.html' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// --- Logout (all roles) ---
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// --- Get current session info ---
app.get('/api/session', (req, res) => {
    if (req.session && req.session.role) {
        res.json({
            loggedIn: true,
            role: req.session.role,
            userId: req.session.userId,
            name: req.session.userName || req.session.candidateName || req.session.username
        });
    } else {
        res.json({ loggedIn: false });
    }
});

// ============================================
// ROUTES: User (Voter) Actions
// ============================================

// Get approved candidates for voting
app.get('/api/candidates/approved', requireUser, async (req, res) => {
    try {
        // SQL: Fetch all approved candidates
        const [candidates] = await db.execute(
            'SELECT candidate_id, full_name, description FROM candidates WHERE is_approved = 1'
        );

        // Check if current user has already voted
        const [voted] = await db.execute(
            'SELECT COUNT(*) AS has_voted FROM votes WHERE user_id = ?',
            [req.session.userId]
        );

        // Check if voting is open
        const votingOpen = await isVotingOpen();

        res.json({
            candidates,
            hasVoted: voted[0].has_voted > 0,
            votingOpen
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Cast a vote
app.post('/api/vote', requireUser, async (req, res) => {
    try {
        const { candidate_id } = req.body;
        const user_id = req.session.userId;

        // Backend check: is voting open?
        const votingOpen = await isVotingOpen();
        if (!votingOpen) {
            return res.status(400).json({ error: 'Voting is closed. The voting period has expired.' });
        }

        // Backend check: has user already voted?
        const [existingVote] = await db.execute(
            'SELECT COUNT(*) AS has_voted FROM votes WHERE user_id = ?', [user_id]
        );
        if (existingVote[0].has_voted > 0) {
            return res.status(400).json({ error: 'You have already voted. Each user can vote only once.' });
        }

        // Backend check: is candidate approved?
        const [candidate] = await db.execute(
            'SELECT is_approved FROM candidates WHERE candidate_id = ?', [candidate_id]
        );
        if (candidate.length === 0 || candidate[0].is_approved !== 1) {
            return res.status(400).json({ error: 'Invalid candidate selection.' });
        }

        // SQL: Insert vote (UNIQUE constraint provides additional DB-level protection)
        await db.execute(
            'INSERT INTO votes (user_id, candidate_id) VALUES (?, ?)',
            [user_id, candidate_id]
        );

        res.json({ message: 'Vote cast successfully! Thank you for voting.' });
    } catch (error) {
        // Catch duplicate vote attempt at DB level
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'You have already voted (database constraint).' });
        }
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ============================================
// ROUTES: Candidate Actions
// ============================================

// View election results (candidate dashboard)
app.get('/api/results', requireCandidate, async (req, res) => {
    try {
        // SQL: Count votes per candidate using GROUP BY
        const [results] = await db.execute(`
            SELECT c.candidate_id, c.full_name, COUNT(v.vote_id) AS total_votes
            FROM candidates c
            LEFT JOIN votes v ON c.candidate_id = v.candidate_id
            WHERE c.is_approved = 1
            GROUP BY c.candidate_id, c.full_name
            ORDER BY total_votes DESC
        `);

        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ============================================
// ROUTES: Admin Actions
// ============================================

// Get all users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT user_id, full_name, email, created_at FROM users'
        );
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get all candidates (with approval status)
app.get('/api/admin/candidates', requireAdmin, async (req, res) => {
    try {
        const [candidates] = await db.execute(
            'SELECT candidate_id, full_name, email, description, is_approved, created_at FROM candidates'
        );
        res.json({ candidates });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Approve a candidate
app.post('/api/admin/candidate/approve', requireAdmin, async (req, res) => {
    try {
        const { candidate_id } = req.body;
        // SQL: Update candidate approval status
        await db.execute('UPDATE candidates SET is_approved = 1 WHERE candidate_id = ?', [candidate_id]);
        res.json({ message: 'Candidate approved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Reject a candidate
app.post('/api/admin/candidate/reject', requireAdmin, async (req, res) => {
    try {
        const { candidate_id } = req.body;
        // SQL: Update candidate rejection status
        await db.execute('UPDATE candidates SET is_approved = 2 WHERE candidate_id = ?', [candidate_id]);
        res.json({ message: 'Candidate rejected' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get vote results (admin view with analysis)
app.get('/api/admin/results', requireAdmin, async (req, res) => {
    try {
        // SQL: Count votes per candidate using GROUP BY and ORDER BY
        const [results] = await db.execute(`
            SELECT c.candidate_id, c.full_name, COUNT(v.vote_id) AS total_votes
            FROM candidates c
            LEFT JOIN votes v ON c.candidate_id = v.candidate_id
            WHERE c.is_approved = 1
            GROUP BY c.candidate_id, c.full_name
            ORDER BY total_votes DESC
        `);

        // SQL: Find the winner (candidate with highest votes)
        const [winner] = await db.execute(`
            SELECT c.full_name, COUNT(v.vote_id) AS total_votes
            FROM candidates c
            LEFT JOIN votes v ON c.candidate_id = v.candidate_id
            WHERE c.is_approved = 1
            GROUP BY c.candidate_id, c.full_name
            ORDER BY total_votes DESC
            LIMIT 1
        `);

        // Total votes cast
        const [totalVotes] = await db.execute('SELECT COUNT(*) AS total FROM votes');

        res.json({
            results,
            winner: winner.length > 0 ? winner[0] : null,
            totalVotes: totalVotes[0].total
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Get voting period settings
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const [settings] = await db.execute('SELECT * FROM settings WHERE setting_id = 1');
        res.json({ settings: settings[0] || null });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Extend voting expiry date
app.post('/api/admin/extend-voting', requireAdmin, async (req, res) => {
    try {
        const { new_end_date } = req.body;

        // Validate that new date is in the future
        if (new Date(new_end_date) <= new Date()) {
            return res.status(400).json({ error: 'New end date must be in the future' });
        }

        // SQL: Update the voting end date
        await db.execute(
            'UPDATE settings SET voting_end_date = ? WHERE setting_id = 1',
            [new_end_date]
        );

        res.json({ message: 'Voting period extended successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ============================================
// START SERVER
// ============================================
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`\n=== Online Voting System ===`);
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Admin login: username=admin, password=admin123\n`);
    });
});
