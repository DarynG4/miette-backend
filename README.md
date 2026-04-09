# miette-backend

> The REST API powering Miette — a sewing project tracker with a social layer.

Miette (French for "crumb") allows sewists to leave a breadcrumb trail of their sewing projects, documenting each garment from first inspiration to finished piece and sharing that journey with a community of people who get it. This repository contains the Express.js backend API, PostgreSQL database schema, and all server-side logic.

---

## Live URLs

| Service      | URL                                              |
| ------------ | ------------------------------------------------ |
| API Base     | `https://miette-backend.onrender.com`            |
| Health Check | `https://miette-backend.onrender.com/api/health` |
| Frontend     | `https://miette-frontend.onrender.com`           |

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Design Principles](#design-principles)

---

## Overview

Miette's backend is a RESTful JSON API built with Node.js and Express. It handles user authentication, project management, social interactions (likes and follows), image uploads via Cloudinary, and the core breadcrumb trail feature — snapshotting project state every time a status changes so users can look back at any stage of a garment's journey.

The backend is intentionally structured around separation of concerns: routing, business logic, and data access are kept in distinct layers. Password hashing happens in the route layer, not the database layer. The database pool is a singleton shared across all route handlers. Environment variables are loaded at the entry point and never hardcoded.

---

## Tech Stack

| Technology                | Role                                   |
| ------------------------- | -------------------------------------- |
| Node.js                   | JavaScript runtime environment         |
| Express.js                | HTTP server and routing framework      |
| PostgreSQL                | Relational database                    |
| `pg` (node-postgres)      | PostgreSQL client — connection pool    |
| `bcrypt`                  | Password hashing                       |
| `jsonwebtoken`            | JWT creation and verification          |
| `dotenv`                  | Environment variable loading           |
| `cors`                    | Cross-origin request handling          |
| `multer` + Cloudinary SDK | File upload handling and image hosting |
| Nodemon                   | Development auto-restart               |
| Postman                   | API testing during development         |

---

## Architecture

```
miette-backend/
├── server.js          — entry point, starts the HTTP server
├── app.js             — Express app configuration, middleware, route mounting
├── db/
│   ├── index.js       — pg connection pool (singleton pattern)
│   └── schema.sql     — full database schema
└── routes/
    ├── health.js      — stack connectivity check
    ├── auth.js        — register and login
    ├── users.js       — profile, search, follow
    ├── projects.js    — CRUD, status transitions
    ├── images.js      — Cloudinary upload and delete
    ├── likes.js       — like and unlike
    └── categories.js  — user-created categories
```

**`server.js` and `app.js` are intentionally separated.** `app.js` creates and configures the Express application without binding to any port. `server.js` imports the configured app and calls `app.listen()`. This separation means test files can import `app.js` directly without starting a live server.

**The database pool in `db/index.js` is a singleton.** Node's module caching system ensures the pool is created exactly once and shared across all route files that import it. This prevents the overhead of creating a new connection pool per request.

---

## Database Schema

Seven tables model the full data relationships of Miette.

### ENUM Types

```sql
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'complete', 'altering');
CREATE TYPE image_type AS ENUM ('inspo', 'in_progress', 'completed');
CREATE TYPE account_status AS ENUM ('public', 'private');
```

### Tables

**`users`** — stores account information

| Column           | Type                                 | Notes                                  |
| ---------------- | ------------------------------------ | -------------------------------------- |
| `id`             | `SERIAL PRIMARY KEY`                 |                                        |
| `username`       | `VARCHAR(30) NOT NULL UNIQUE`        |                                        |
| `email`          | `TEXT NOT NULL UNIQUE`               |                                        |
| `password_hash`  | `TEXT NOT NULL`                      | bcrypt hash, never plain text          |
| `first_name`     | `TEXT NOT NULL`                      |                                        |
| `display_name`   | `TEXT`                               | defaults to first_name on registration |
| `last_name`      | `TEXT`                               | optional                               |
| `bio`            | `TEXT`                               | optional                               |
| `avatar_url`     | `TEXT`                               | Cloudinary URL                         |
| `account_status` | `account_status`                     | defaults to `'public'`                 |
| `created_at`     | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |                                        |
| `updated_at`     | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |                                        |

**`projects`** — stores project data

| Column                | Type                                                      | Notes                                 |
| --------------------- | --------------------------------------------------------- | ------------------------------------- |
| `id`                  | `SERIAL PRIMARY KEY`                                      |                                       |
| `user_id`             | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` |                                       |
| `category_id`         | `INTEGER REFERENCES categories(id) ON DELETE SET NULL`    | nullable                              |
| `title`               | `TEXT`                                                    | optional                              |
| `status`              | `project_status NOT NULL DEFAULT 'planning'`              | ENUM                                  |
| `is_public`           | `BOOLEAN NOT NULL DEFAULT true`                           |                                       |
| `description`         | `TEXT`                                                    |                                       |
| `season`              | `TEXT[]`                                                  | array — supports multiple seasons     |
| `item_type`           | `TEXT`                                                    |                                       |
| `uses_pattern`        | `BOOLEAN DEFAULT false`                                   |                                       |
| `pattern_name`        | `TEXT`                                                    |                                       |
| `pattern_size`        | `TEXT`                                                    |                                       |
| `pattern_link`        | `TEXT`                                                    |                                       |
| `pattern_adjustments` | `TEXT`                                                    |                                       |
| `is_self_drafted`     | `BOOLEAN DEFAULT false`                                   |                                       |
| `is_upcycled`         | `BOOLEAN DEFAULT false`                                   |                                       |
| `previous_item_type`  | `TEXT`                                                    |                                       |
| `fabric`              | `TEXT`                                                    | labelled "Planned" in planning status |
| `thread`              | `TEXT`                                                    |                                       |
| `haberdashery`        | `TEXT`                                                    |                                       |
| `created_at`          | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                      |                                       |
| `updated_at`          | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                      |                                       |

**`project_status_history`** — snapshot of a project every time its status changes

Mirrors all content fields from `projects`. A new row is inserted _before_ a status change takes effect, capturing the project's final state in the previous status. This is the breadcrumb trail — the soul of the app.

| Column        | Type                                                         | Notes                                         |
| ------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `id`          | `SERIAL PRIMARY KEY`                                         |                                               |
| `project_id`  | `INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE` |                                               |
| `status_from` | `project_status NOT NULL`                                    | the status being left                         |
| `title`       | `TEXT`                                                       | snapshot of project fields at transition time |
| `description` | `TEXT`                                                       |                                               |
| `season`      | `TEXT[]`                                                     |                                               |
| `...`         |                                                              | all other project content fields mirrored     |
| `recorded_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                         |                                               |

**`project_images`** — image URLs tied to a project

| Column        | Type                                                         | Notes                               |
| ------------- | ------------------------------------------------------------ | ----------------------------------- |
| `id`          | `SERIAL PRIMARY KEY`                                         |                                     |
| `project_id`  | `INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE` |                                     |
| `image_url`   | `TEXT NOT NULL`                                              | Cloudinary URL                      |
| `image_type`  | `image_type NOT NULL`                                        | ENUM: inspo, in_progress, completed |
| `uploaded_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                         |                                     |

**`follows`** — one-way follow relationships between users

| Column         | Type                                                      | Notes                        |
| -------------- | --------------------------------------------------------- | ---------------------------- |
| `id`           | `SERIAL PRIMARY KEY`                                      |                              |
| `follower_id`  | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` | the user doing the following |
| `following_id` | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` | the user being followed      |
| `created_at`   | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                      |                              |
|                | `UNIQUE(follower_id, following_id)`                       | prevents duplicate follows   |

**`likes`** — which user liked which project

| Column       | Type                                                         | Notes                    |
| ------------ | ------------------------------------------------------------ | ------------------------ |
| `id`         | `SERIAL PRIMARY KEY`                                         |                          |
| `user_id`    | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`    |                          |
| `project_id` | `INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE` |                          |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                         |                          |
|              | `UNIQUE(user_id, project_id)`                                | prevents duplicate likes |

**`categories`** — user-created project categories

| Column       | Type                                                      | Notes                                |
| ------------ | --------------------------------------------------------- | ------------------------------------ |
| `id`         | `SERIAL PRIMARY KEY`                                      |                                      |
| `user_id`    | `INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE` |                                      |
| `name`       | `TEXT NOT NULL`                                           |                                      |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`                      |                                      |
|              | `UNIQUE(user_id, name)`                                   | no duplicate category names per user |

---

## API Endpoints

All endpoints are prefixed with `/api`. Protected endpoints require a `Bearer <token>` Authorization header.

### Auth

| Method | Path                 | Description              | Auth |
| ------ | -------------------- | ------------------------ | ---- |
| `POST` | `/api/auth/register` | Create a new account     | No   |
| `POST` | `/api/auth/login`    | Log in and receive a JWT | No   |

### Users

| Method   | Path                       | Description                       | Auth     |
| -------- | -------------------------- | --------------------------------- | -------- |
| `GET`    | `/api/users/:username`     | Get a user's public profile       | No       |
| `PATCH`  | `/api/users/:id`           | Update own profile                | Required |
| `GET`    | `/api/users/:id/projects`  | Get all projects by a user        | No       |
| `GET`    | `/api/users/:id/liked`     | Get all projects a user has liked | No       |
| `GET`    | `/api/users/search?query=` | Search users by username          | Required |
| `POST`   | `/api/users/:id/follow`    | Follow a user                     | Required |
| `DELETE` | `/api/users/:id/follow`    | Unfollow a user                   | Required |
| `GET`    | `/api/users/:id/followers` | Get a user's followers            | No       |
| `GET`    | `/api/users/:id/following` | Get who a user follows            | No       |

### Projects

| Method   | Path                           | Description                           | Auth     |
| -------- | ------------------------------ | ------------------------------------- | -------- |
| `GET`    | `/api/projects`                | Get home feed (followed + discovery)  | Required |
| `GET`    | `/api/projects/:id`            | Get one project with full details     | No\*     |
| `POST`   | `/api/projects`                | Create a new project                  | Required |
| `PATCH`  | `/api/projects/:id`            | Edit project fields                   | Required |
| `DELETE` | `/api/projects/:id`            | Delete a project                      | Required |
| `PATCH`  | `/api/projects/:id/status`     | Move to a new status (saves snapshot) | Required |
| `GET`    | `/api/projects/:id/history`    | Get status history snapshots          | No\*     |
| `PATCH`  | `/api/projects/:id/categories` | Assign project to a category          | Required |

\*Public projects only for unauthenticated requests.

### Images

| Method   | Path                       | Description                | Auth     |
| -------- | -------------------------- | -------------------------- | -------- |
| `POST`   | `/api/projects/:id/images` | Upload images to a project | Required |
| `DELETE` | `/api/images/:id`          | Delete a specific image    | Required |

### Likes

| Method   | Path                     | Description      | Auth     |
| -------- | ------------------------ | ---------------- | -------- |
| `POST`   | `/api/projects/:id/like` | Like a project   | Required |
| `DELETE` | `/api/projects/:id/like` | Unlike a project | Required |

### Categories

| Method   | Path                        | Description                   | Auth     |
| -------- | --------------------------- | ----------------------------- | -------- |
| `GET`    | `/api/users/:id/categories` | Get all categories for a user | No       |
| `POST`   | `/api/categories`           | Create a new category         | Required |
| `PATCH`  | `/api/categories/:id`       | Rename a category             | Required |
| `DELETE` | `/api/categories/:id`       | Delete a category             | Required |

### Health

| Method | Path          | Description                            | Auth |
| ------ | ------------- | -------------------------------------- | ---- |
| `GET`  | `/api/health` | Confirms API and database connectivity | No   |

---

## Project Structure

```
miette-backend/
├── .env.example       — environment variable template
├── .gitignore
├── package.json
├── server.js          — entry point
├── app.js             — Express configuration
├── db/
│   ├── index.js       — pg Pool singleton
│   └── schema.sql     — full database schema
└── routes/
    ├── health.js
    ├── auth.js
    ├── users.js
    ├── projects.js
    ├── images.js
    ├── likes.js
    └── categories.js
```

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
# clone the repository
git clone https://github.com/DarynG4/miette-backend.git
cd miette-backend

# install dependencies
npm install

# create local database
createdb miette_dev

# copy environment variable template
cp .env.example .env
# fill in your values in .env

# run the database schema
psql miette_dev -f db/schema.sql

# start development server
npm run dev
```

The server starts on port 8080 by default. Test connectivity:

```bash
curl http://localhost:8080/api/health
```

Expected response:

```json
{
  "message": "Miette API is alive!",
  "db": "connected"
}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running locally.

| Variable                | Description                                             | Example                             |
| ----------------------- | ------------------------------------------------------- | ----------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                            | `postgresql://localhost/miette_dev` |
| `JWT_SECRET`            | Secret key for signing JWTs — must be long and random   | `abc123...`                         |
| `CORS_ORIGIN`           | Allowed frontend origin                                 | `http://localhost:5173`             |
| `PORT`                  | Server port (set automatically by Render in production) | `8080`                              |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name                           |                                     |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                      |                                     |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                                   |                                     |

Never commit `.env`. It is listed in `.gitignore`.

---

## Deployment

The backend is deployed on [Render](https://render.com) as a Web Service. The PostgreSQL database is also hosted on Render as a managed database.

Render automatically redeploys the backend whenever changes are pushed to the `main` branch.

**Production environment variables** are stored in Render's Secret Files — not in the repository.

**Database migrations** are run manually against the production database URL:

```bash
psql $PRODUCTION_DATABASE_URL -f db/schema.sql
```

---

## Design Principles

**Separation of concerns** — routing, business logic, and data access are distinct layers. Password hashing happens in route handlers, not database queries. The database pool is isolated in its own module.

**Secure by Design** — passwords are bcrypt-hashed before storage. JWTs are verified on every protected route by authentication middleware. Parameterized queries prevent SQL injection on every database call. CORS is restricted to known origins only.

**DRY** — authentication middleware is written once and applied to all protected routes. The database pool is a singleton. Shared logic is extracted into utility functions.

**RESTful conventions** — `PATCH` for partial updates, `DELETE` for removal, status codes that accurately communicate outcomes (`200`, `201`, `400`, `401`, `403`, `404`, `500`).

**ON DELETE behavior is explicit on every foreign key** — `CASCADE` where child data should be removed with its parent, `SET NULL` where the relationship should be severed without destroying the child record.
