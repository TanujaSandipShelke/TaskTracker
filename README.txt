# Ethara AI — Team Task Manager

A full-stack web application for team project management, task assignment, and progress tracking with role-based access control (Admin/Member).

Built by Ethara AI

Live URL: https://web-production-228f7.up.railway.app
GitHub Repo: https://github.com/HassamUmar/TeamTracker


## Features

- Authentication — Signup & Login with JWT tokens (first user auto-promoted to Admin)
- Role-Based Access Control — Admin & Member roles at both global and project levels
- Project Management — Create, edit, delete projects with descriptions and status tracking
- Task Management — Kanban-style board with 4 status columns (To Do / In Progress / Review / Done)
- Team Management — Add/remove project members with role-based permissions
- Dashboard — Real-time stats: task breakdown, overdue tasks, recent activity, completion percentage
- Responsive Design — Works on desktop, tablet, and mobile


## Tech Stack

| Layer      | Technology               |
|------------|--------------------------|
| Frontend   | React + Vite             |
| Backend    | Node.js + Express        |
| Database   | SQLite (sql.js - WASM)   |
| Auth       | JWT + bcryptjs           |
| Routing    | React Router DOM         |
| Styling    | Custom CSS (dark theme)  |
| Deployment | Railway                  |


## Installation

# Clone the repository
git clone https://github.com/Manas1718/Team-Task-Manager.git
cd Team-Task-Manager

# Install backend dependencies
npm install

# Build the React frontend
npm run build

# Start the server
npm start

The app will be available at http://localhost:3000


## Environment Variables

Create a .env file in the root directory:

PORT=3000
JWT_SECRET=your-secret-key-here


## Project Structure

ethara-task-manager/
├── server.js              # Express server entry point
├── database.js            # SQLite database setup (sql.js WASM)
├── package.json           # Backend deps + build scripts
├── Procfile               # Railway deployment
├── vercel.json            # Vercel deployment config
├── middleware/
│   └── auth.js            # JWT authentication & RBAC middleware
├── routes/
│   ├── auth.js            # Signup, Login, User listing
│   ├── projects.js        # Project CRUD + Member management
│   ├── tasks.js           # Task CRUD + Filtering
│   └── dashboard.js       # Dashboard aggregation stats
├── client/                # React Frontend (Vite)
│   ├── src/
│   │   ├── App.jsx        # Main app with routing
│   │   ├── api.js         # REST API wrapper
│   │   ├── index.css      # Complete dark theme styles
│   │   ├── main.jsx       # React entry point
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Auth state management
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar + main layout
│   │   │   └── Modal.jsx        # Reusable modal component
│   │   └── pages/
│   │       ├── AuthPage.jsx     # Login / Signup
│   │       ├── Dashboard.jsx    # Stats & overview
│   │       ├── Projects.jsx     # Project listing
│   │       ├── ProjectDetail.jsx # Kanban board
│   │       ├── Tasks.jsx        # My tasks list
│   │       └── Team.jsx         # Team members
│   ├── package.json
│   └── vite.config.js
├── public/                # Built React output (served by Express)
├── data/                  # SQLite database storage
└── README.md


## API Endpoints

### Auth
POST   /api/auth/signup       Register new user
POST   /api/auth/login        Login
GET    /api/auth/me           Get current user
GET    /api/auth/users        List all users

### Projects
GET    /api/projects           List user's projects
POST   /api/projects           Create project
GET    /api/projects/:id       Get project with members & tasks
PUT    /api/projects/:id       Update project
DELETE /api/projects/:id       Delete project
POST   /api/projects/:id/members       Add member to project
DELETE /api/projects/:id/members/:uid  Remove member from project

### Tasks
GET    /api/tasks              List user's tasks (filterable)
POST   /api/tasks/project/:pid Create task in project
PUT    /api/tasks/:id          Update task
DELETE /api/tasks/:id          Delete task

### Dashboard
GET    /api/dashboard          Get dashboard stats


## Role-Based Access Control

- Admin: Can view all projects, create projects, manage all members and tasks
- Member: Can view assigned projects, create/edit tasks within their projects
- Project Admin: Creator of a project becomes project admin, can manage members
- First Signup: The very first user to register automatically becomes a global Admin


## Deployment

### Railway (Current)
1. Push code to GitHub
2. Go to railway.app and create a new project
3. Connect your GitHub repository
4. Add environment variable: JWT_SECRET = your-secret-key
5. Railway auto-detects Procfile and deploys
6. Generate a public domain in Settings > Networking

### Vercel (Alternative)
1. Push code to GitHub
2. Import project on vercel.com
3. Framework Preset: Other
4. Add environment variable: JWT_SECRET = your-secret-key
5. Deploy


## Submission Checklist

[x] Live URL: https://web-production-228f7.up.railway.app
[x] GitHub Repo: https://github.com/HassamUmar/TeamTracker
[x] README documentation
[ ] 2-5 min demo video


## License

MIT
