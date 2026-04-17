DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS likes;
DROP TABLE IF EXISTS project_images;
DROP TABLE IF EXISTS project_status_history;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS account_status;
DROP TYPE IF EXISTS image_type;
DROP TYPE IF EXISTS project_status;

--==================================================================================
-- ENUM TYPES
--==================================================================================

CREATE TYPE project_status AS ENUM (
    'planning',
    'in_progress',
    'complete',
    'altering'
);

CREATE TYPE image_type AS ENUM (
    'inspo', 
    'in_progress', 
    'completed' 
);

CREATE TYPE account_status AS ENUM (
    'public',
    'private'
);

--==================================================================================
-- TABLES
--==================================================================================

CREATE TABLE users(
    id serial PRIMARY KEY,
    username varchar(30) NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    first_name text NOT NULL,
    display_name text, 
    last_name text,
    bio text,
    avatar_url text, 
    account_status account_status NOT NULL DEFAULT 'public',
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE categories(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE TABLE projects(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id integer REFERENCES categories(id) ON DELETE SET NULL,
    title text,
    status project_status NOT NULL DEFAULT 'planning',
    is_public boolean NOT NULL DEFAULT true,
    description text,
    notes text,
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

CREATE TABLE project_status_history(
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title text,
    status_from project_status NOT NULL, 
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

CREATE TABLE project_images(
    id serial PRIMARY KEY,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    image_type image_type NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE likes(
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

CREATE TABLE follows(
    id serial PRIMARY KEY,
    follower_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);
