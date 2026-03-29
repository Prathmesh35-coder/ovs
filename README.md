# 🗳️ Online Voting System

A full-stack web application for online voting with three user roles: **Admin**, **Voter**, and **Candidate**. Built with Node.js/Express backend, plain HTML/CSS/JS frontend, and MySQL database.

---

## 📁 Project Structure

```
online-voting-system/
├── database/
│   └── schema.sql          # MySQL schema, constraints, sample data, SQL queries
├── backend/
│   ├── package.json        # Node.js dependencies
│   └── server.js           # Express server with all API routes
├── frontend/
│   ├── css/
│   │   └── style.css       # Stylesheet
│   ├── js/
│   │   └── app.js          # Shared JavaScript utilities
│   ├── index.html           # Home page
│   ├── login.html           # Login page (all roles)
│   ├── register.html        # Registration page (voter & candidate)
│   ├── user-dashboard.html  # Voter dashboard (cast vote)
│   ├── candidate-dashboard.html  # Candidate dashboard (view results)
│   └── admin-dashboard.html # Admin dashboard (manage everything)
└── README.md               # This file
```

---

## 🛠️ Prerequisites

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **MySQL** (v8.0 or higher) - [Download](https://dev.mysql.com/downloads/)
3. **npm** (comes with Node.js)

---

## 🚀 Step-by-Step Setup Instructions

### Step 1: Install MySQL and Start the Server

Make sure MySQL is installed and running on your machine.

- **Windows**: MySQL Installer or XAMPP
- **macOS**: `brew install mysql && brew services start mysql`
- **Linux**: `sudo apt install mysql-server && sudo systemctl start mysql`

### Step 2: Create the Database (Optional - Auto-Created)

The server automatically creates the database and tables on first run. But if you want to do it manually:

```bash
mysql -u root -p < database/schema.sql
```

### Step 3: Configure Database Credentials

Open `backend/server.js` and update the database config (around line 42):

```javascript
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '',  // <-- Set your MySQL root password here
    database: 'online_voting_system',
};
```

### Step 4: Install Dependencies

```bash
cd backend
npm install
```

### Step 5: Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### Step 6: Open the Application

Open your browser and go to: **http://localhost:3000**

---

## 🔑 Default Admin Credentials

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

> The admin account is automatically created on first server start.

---

## 📋 Features by Role

### 👤 Voter (User)
- Register with name, email, and password
- Login and get redirected to the voting dashboard
- See only approved candidates
- Vote for one candidate only (enforced by UNIQUE constraint)
- See "Voting Closed" message if the period has expired

### 🎤 Candidate
- Register with name, email, password, and description
- Login and view current election results
- Cannot vote (separate role/table)
- Must wait for admin approval to appear in voting list

### 🔑 Admin
- Login (no registration - seeded on first run)
- View all registered voters
- View all candidates and approve/reject them
- View total votes per candidate (GROUP BY query)
- See the leading candidate (highest votes analysis)
- Extend the voting expiry date

---

## 🗄️ Database Schema

### Tables

| Table       | Purpose                               |
|-------------|---------------------------------------|
| `admins`    | Admin login credentials               |
| `users`     | Registered voters                     |
| `candidates`| Registered candidates                 |
| `votes`     | Vote records (FK to users & candidates)|
| `settings`  | Voting period start/end dates         |

### Key Constraints

- **Primary Keys**: Auto-increment `id` on every table
- **Foreign Keys**: `votes.user_id → users.user_id`, `votes.candidate_id → candidates.candidate_id`
- **UNIQUE**: `votes.user_id` - ensures each voter can only vote once
- **Cascade**: `ON DELETE CASCADE` on foreign keys

### Important SQL Queries (in schema.sql)

1. Fetch approved candidates
2. Insert vote with duplicate prevention
3. Count votes per candidate (`GROUP BY`)
4. Find the winner (`ORDER BY ... LIMIT 1`)
5. Check if a user has voted
6. Extend voting period
7. Approve/reject candidates

---

## 🔒 Security Notes

- Passwords are hashed using **bcrypt** (10 salt rounds)
- Sessions are managed with **express-session**
- Voting restriction enforced at **both** backend (code) and **database** (UNIQUE constraint) levels
- Voting period enforced at **both** backend and database levels
- Role-based route protection via middleware
- Basic XSS prevention in frontend rendering

---

## 🧪 Testing the Application

1. **Register** two voters and two candidates
2. **Login as Admin** → Approve the candidates
3. **Login as Voter** → Vote for a candidate
4. **Try voting again** → Should be blocked (UNIQUE constraint)
5. **Login as Candidate** → View results
6. **Admin** → View results, see winner analysis
7. **Admin** → Change voting end date to the past → Voters see "Voting Closed"

---

## ⚠️ Notes

- This is an academic/learning project focused on **database design and SQL usage**
- For production use, add: HTTPS, CSRF protection, rate limiting, input sanitization, proper session store (Redis)
- The UI is intentionally basic to emphasize backend logic and database design
