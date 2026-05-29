# Aurum Project Controls — Setup Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Docker)
- npm 9+

---

## Quick Start (with Docker for the database)

### 1. Start the PostgreSQL database
```bash
docker-compose up postgres -d
```

### 2. Set up the server
```bash
cd server
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET
npm install
npm run db:migrate   # runs Prisma migrations
npm run db:seed      # creates demo users + project
npm run dev          # starts on http://localhost:5000
```

### 3. Set up the client
```bash
cd client
npm install
npm run dev          # starts on http://localhost:5173
```

### Or run both together from root:
```bash
npm install
npm run dev
```

---

## Environment Variables (server/.env)

| Variable      | Default                                              | Description           |
|---------------|------------------------------------------------------|-----------------------|
| DATABASE_URL  | postgresql://aurum:aurum_secret@localhost:5432/aurum_db | PostgreSQL connection |
| JWT_SECRET    | (required)                                           | JWT signing secret    |
| CLIENT_URL    | http://localhost:5173                               | CORS allowed origin   |
| PORT          | 5000                                                | API server port       |

---

## Demo Credentials (after seeding)

| Role               | Email                  | Password      |
|--------------------|------------------------|---------------|
| Admin              | admin@aurum.com        | Admin1234!    |
| Commercial Manager | manager@aurum.com      | Manager1234!  |

---

## NEC Workflow (Compensation Events)
```
NOTIFIED → QUOTED → ASSESSED → IMPLEMENTED → CLOSED
```

## Clause References
- Early Warning: NEC4 clause 15.1
- Compensation Events: NEC4 clauses 60–66

---

## API Endpoints Summary

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET  /api/auth/me`

### Projects
- `GET  /api/projects`
- `POST /api/projects`
- `GET  /api/projects/:id`
- `PUT  /api/projects/:id`

### Early Warnings
- `GET  /api/projects/:id/early-warnings`
- `POST /api/projects/:id/early-warnings`
- `PUT  /api/projects/:id/early-warnings/:ewId`
- `DELETE /api/projects/:id/early-warnings/:ewId`

### Risk Register
- `GET  /api/projects/:id/risks`
- `POST /api/projects/:id/risks`
- `PUT  /api/projects/:id/risks/:rId`
- `DELETE /api/projects/:id/risks/:rId`

### Compensation Events
- `GET  /api/projects/:id/compensation-events`
- `POST /api/projects/:id/compensation-events`
- `PUT  /api/projects/:id/compensation-events/:ceId`
- `DELETE /api/projects/:id/compensation-events/:ceId`
- `POST /api/projects/:id/compensation-events/:ceId/documents`

### Notices
- `GET  /api/projects/:id/notices`
- `POST /api/projects/:id/notices`
- `GET  /api/projects/:id/notices/:nId/pdf`
- `DELETE /api/projects/:id/notices/:nId`

### Dashboard & Reports
- `GET  /api/projects/:id/dashboard`
- `GET  /api/projects/:id/audit-log`
- `GET  /api/projects/:id/reports/commercial`
- `GET  /api/projects/:id/reports/ce-summary`
- `GET  /api/projects/:id/reports/risk-register`
