# TERMINAL — Technical Requirements

## 1. Technology Stack [IMPLEMENTED]

### Frontend
- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS + Custom CSS (`index.css` for variables and animations)
- **State/Data Fetching:** React Query (`@tanstack/react-query`)
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **Reasoning:** Vite provides rapid build times for development. React Query gracefully handles server state without bloating global context, and TailwindCSS enables rapid prototyping of the Brutalist design system.

### Backend
- **Framework:** Express.js (Node.js)
- **Language:** TypeScript
- **Real-Time:** Socket.IO
- **Reasoning:** Express provides a lightweight, unopinionated routing layer that pairs perfectly with Socket.IO for the live-event architecture.

### Database & ORM
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Reasoning:** PostgreSQL ensures relational data integrity (important for scores, submissions, and users), and Prisma generates strict TypeScript types directly from the schema.

### Authentication & Security
- **Mechanism:** JWT (JSON Web Tokens)
- **Storage:** Local Storage (`terminal_token`)
- **Passwords:** Hashed (bcrypt logic on the server)
- **Socket Auth:** JWT passed during Socket.IO handshake (`auth.token`)

## 2. Infrastructure & Environment
- **Environment Variables:**
  - `DATABASE_URL`: PostgreSQL connection string
  - `JWT_SECRET`: Secret for signing auth tokens
  - `PORT`: Express server port
  - `CORS_ORIGIN`: Allowed origins for the frontend
- **Development Tooling:** `tsc` (TypeScript compiler), standard npm scripts (`build`, `dev`).

## 3. Important Architectural Principles
- **One Platform:** TERMINAL is a single codebase. Club-specific content (LANGNET, CODENEX) does NOT require separate applications.
- **One Real-Time System:** Sockets handle all live session states globally.
- **Server-Authoritative:** All scoring and session state transitions happen on the server to prevent client-side cheating.
