--============================================================
--  Photohub database schema  (PostgreSQL >= 16)
--  Generated: 2025-06-06
--============================================================
--  Extensions ------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- optional fuzzy search

--============================================================
--  Enumerated types -----------------------------------------
CREATE TYPE user_role_t         AS ENUM ('user','moderator','admin');
CREATE TYPE post_visibility_t   AS ENUM ('public','paywall');
CREATE TYPE membership_status_t AS ENUM ('active','grace','expired');

--============================================================
--  Core tables ----------------------------------------------

-- 1. Users ---------------------------------------------------
CREATE TABLE site_users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    varchar(64) UNIQUE NOT NULL,
    avatar_url      text,
    bio             text,
    primary_wallet  varchar(128),
    role            user_role_t NOT NULL DEFAULT 'user',
    is_banned       boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_seen       timestamptz
);
CREATE INDEX site_users_last_seen_idx ON site_users(last_seen);

-- 2. Wallets -------------------------------------------------
CREATE TABLE wallets (
    caip10_id   varchar(128) PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
    label       varchar(32),
    is_primary  boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallets_user_idx       ON wallets(user_id);
-- Only one primary wallet per user
CREATE UNIQUE INDEX wallets_primary_uq ON wallets(user_id) WHERE is_primary;

-- Add FK from site_users.primary_wallet to wallets now that both tables exist
ALTER TABLE site_users
  ADD CONSTRAINT site_users_primary_wallet_fkey
  FOREIGN KEY (primary_wallet) REFERENCES wallets(caip10_id) ON DELETE SET NULL;

-- 3. Posts ---------------------------------------------------
CREATE TABLE posts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       uuid NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
    caption         text,
    media_url       text NOT NULL,
    visibility      post_visibility_t NOT NULL DEFAULT 'public',
    price_usd_month numeric(10,2),
    currency_caip2  varchar(16) DEFAULT 'eip155:8453',
    split_addr      varchar(42),
    like_count      int     NOT NULL DEFAULT 0,
    comment_count   int     NOT NULL DEFAULT 0,
    hot_score       float8  NOT NULL DEFAULT 0,
    hidden          boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    fts             tsvector GENERATED ALWAYS AS (
                       setweight(to_tsvector('simple', coalesce(caption,'')), 'A')
                     ) STORED
);
CREATE INDEX posts_author_idx    ON posts(author_id);
CREATE INDEX posts_hot_idx       ON posts(hot_score DESC);
CREATE INDEX posts_fts_gin       ON posts USING GIN (fts);

-- 4. Likes ---------------------------------------------------
CREATE TABLE likes (
    post_id     uuid           REFERENCES posts(id)   ON DELETE CASCADE,
    caip10_id   varchar(128)   REFERENCES wallets(caip10_id) ON DELETE CASCADE,
    created_at  timestamptz    NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, caip10_id)
);
CREATE INDEX likes_wallet_idx ON likes(caip10_id);

-- 5. Comments ------------------------------------------------
CREATE TABLE comments (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     uuid NOT NULL REFERENCES posts(id)          ON DELETE CASCADE,
    parent_id   uuid       REFERENCES comments(id)          ON DELETE CASCADE,
    caip10_id   varchar(128) REFERENCES wallets(caip10_id)  ON DELETE CASCADE,
    body        text NOT NULL,
    hidden      boolean     NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON comments(post_id, created_at);

-- 6. Comment votes (optional) --------------------------------
CREATE TABLE comment_votes (
    comment_id  uuid          REFERENCES comments(id)        ON DELETE CASCADE,
    caip10_id   varchar(128)  REFERENCES wallets(caip10_id)  ON DELETE CASCADE,
    value       smallint      NOT NULL CHECK (value IN (-1,1)),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, caip10_id)
);

-- 7. Paywall purchases --------------------------------------
CREATE TABLE paywall_purchases (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     uuid          NOT NULL REFERENCES posts(id)          ON DELETE CASCADE,
    caip10_id   varchar(128) NOT NULL REFERENCES wallets(caip10_id) ON DELETE CASCADE,
    chain_id    int          NOT NULL,
    tx_hash     varchar(80)  NOT NULL,
    paid_at     timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (post_id, caip10_id)
);

-- 8. Subscription tiers -------------------------------------
CREATE TABLE sub_tier (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      uuid          NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
    title           varchar(64)   NOT NULL,
    description     text,
    price_usd_month numeric(10,2) NOT NULL,
    active          boolean       NOT NULL DEFAULT true,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (creator_id, title)
);

-- 9. Memberships --------------------------------------------
CREATE TABLE memberships (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid          NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
    tier_id        uuid          NOT NULL REFERENCES sub_tier(id)  ON DELETE CASCADE,
    currency_caip2 varchar(16)   NOT NULL,
    tx_hash        varchar(80)   NOT NULL,
    started_at     timestamptz   NOT NULL DEFAULT now(),
    expires_at     timestamptz,
    status         membership_status_t NOT NULL DEFAULT 'active',
    UNIQUE (user_id, tier_id)
);

-- 10. User preferences --------------------------------------
CREATE TABLE user_prefs (
    user_id     uuid PRIMARY KEY REFERENCES site_users(id) ON DELETE CASCADE,
    lang        varchar(8)  NOT NULL DEFAULT 'en',
    email_notif boolean     NOT NULL DEFAULT true,
    push_notif  boolean     NOT NULL DEFAULT true,
    theme       varchar(8)  NOT NULL DEFAULT 'system'
);

-- 11. User flags / achievements -----------------------------
CREATE TABLE user_flags (
    user_id   uuid          NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,
    flag      varchar(32)   NOT NULL,
    set_by    uuid          REFERENCES directus_users(id)      ON DELETE SET NULL,
    set_at    timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, flag)
);

-- 12. Platform-wide settings (single row) -------------------
CREATE TABLE platform_settings (
    id                  int PRIMARY KEY CHECK (id = 1),
    platform_fee_bps    int             NOT NULL DEFAULT 1000, -- 10 %
    min_price_usd       numeric(10,2)   NOT NULL DEFAULT 1.00
);
INSERT INTO platform_settings(id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- 13. Ranking weights ---------------------------------------
CREATE TABLE ranking_settings (
    id                int PRIMARY KEY CHECK (id = 1),
    likes_weight      numeric NOT NULL DEFAULT 0.4,
    comments_weight   numeric NOT NULL DEFAULT 0.5,
    shares_weight     numeric NOT NULL DEFAULT 0.1
);
INSERT INTO ranking_settings(id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

--============================================================
--  Support indexes / RLS policies can be added in separate
--  migration scripts or via Directus Flows & UI.
--============================================================

