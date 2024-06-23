CREATE TABLE template_batch (
  id SERIAL PRIMARY KEY NOT NULL,
  latest_committed_time TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE template (
  id SERIAL PRIMARY KEY NOT NULL,
  batch_id INTEGER REFERENCES template_batch (id) NOT NULL,
  name TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
