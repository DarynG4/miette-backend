-- drop tables in reverse dependency order
-- reverse order prevents foreign key constraint errors during drops
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS project_images;
DROP TABLE IF EXISTS project_status_history;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- drop custom types after all tables that reference them are gone
DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS image_type;
DROP TYPE IF EXISTS project_status;

--==================================================================================
-- ENUM TYPES
-- custom types must be defined before the tables that use them
--==================================================================================

CREATE TYPE project_status AS ENUM (
    'planning',
    'in_progress',
    'complete',
    'altering'
);

CREATE TYPE image_type AS ENUM (
    'inspo', -- inspiration / mood board photos
    'in_progress', -- photos taken during the process
    'completed' -- photos of the finished garment
);

CREATE TYPE account_status AS ENUM (
    'public', -- projects visible to all users (MVP)
    'private' -- projects visible to approved followers only (stretch goal)
);

--==================================================================================
-- TABLES
-- creation order follows dependency chain:
-- users → categories → projects → history / images / likes / follows
--==================================================================================

-- stores user account information
CREATE TABLE users(
    id serial PRIMARY KEY,
    username varchar(30) NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    display_name text, -- editable, defaults to first_name on registration
    last_name text,
    bio text,
    avatar_url text,  -- cloudinary url
    account_status account_status NOT NULL DEFAULT 'public',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- stores user-created project categories
-- a category belongs to one user and a project can belong to at most one category (MVP)
CREATE TABLE categories(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name) -- a user cannot have two categories with the same name
);

-- stores sewing project data
-- season is a text array to support multiple seasons per project
-- fabric/thread/haberdashery are labelled 'planned' in planning status and 'used' otherwise (frontend concern)
CREATE TABLE projects(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id integer REFERENCES categories(id) ON DELETE SET NULL,
    title text,
    status project_status NOT NULL DEFAULT 'planning',
    is_public boolean NOT NULL DEFAULT true,
    description text,
    notes text, -- working notes, always available regardless of status or pattern toggle
    season text[],
    item_type text,
    uses_pattern boolean DEFAULT false,
    pattern_name text,
    pattern_size text,
    pattern_link text,
    pattern_adjustments text,
    is_self_drafted boolean DEFAULT false,
    is_upcycled boolean DEFAULT false,
    previous_item_type text,
    fabric text,
    thread text,
    haberdashery text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- snapshots project state every time its status changes
-- a new row is inserted BEFORE the status update takes effect
-- this is the breadcrumb trail — the core feature miette is named after
-- mirrors all content fields from projects (excludes is_public and category_id — metadata, not content)
CREATE TABLE project_status_history(
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title text,
    status_from project_status NOT NULL, -- the status being left at the time of the snapshot
    description text,
    notes text,
    season text[],
    item_type text,
    uses_pattern boolean,
    pattern_name text,
    pattern_size text,
    pattern_link text,
    pattern_adjustments text,
    is_self_drafted boolean,
    is_upcycled boolean,
    previous_item_type text,
    fabric text,
    thread text,
    haberdashery text,
    recorded_at timestamptz NOT NULL DEFAULT NOW()
);

-- stores cloudinary image urls tied to a project
-- images are not stored in the database — only the url returned by cloudinary
CREATE TABLE project_images(
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    image_type image_type NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT NOW()
);

-- stores which user liked which project
-- a user can only like a specific project once
CREATE TABLE likes(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

-- stores one-way follow relationships between users
-- follower_id follows following_id (instagram-style, no approval required for public accounts)
-- a user can only follow another user once
CREATE TABLE follows(
    id serial PRIMARY KEY,
    follower_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);
