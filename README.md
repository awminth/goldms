# Shwe Tharaphu Gold Shop Management System (goldMS)

SplitDeploy layout: sibling `frontend/` + `backend/`.

## Ports

| Service | Port |
|---------|------|
| Frontend (Vite HMR) | **7020** |
| Backend API | **7021** |

## Local development (one command)

```bash
cd backend
npm install
cd ../frontend && npm install && cd ../backend
npm run dev
```

This starts **both** the Express API and the Vite frontend via `concurrently` (not `dist`).

- UI: http://localhost:7020
- API: http://localhost:7021/api/health

Default login: `admin` / PIN `1234` (also `manager`, `cashier`).

## Database

Configured in `backend/.env`:

- Host `localhost:3306`
- User `root`
- Database `mt_goldms`

On startup the API creates the database/tables and seeds demo data if empty.

```bash
cd backend && npm run db:init
```

## Production

```bash
cd backend
npm run build   # builds frontend → copies to backend/dist
npm start       # single Express process: API + static dist on BACKEND_PORT
```
