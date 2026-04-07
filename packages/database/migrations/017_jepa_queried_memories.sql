-- Migration: JEPA queried memories tracking table
-- Used by the JEPA dream cycle Phase 4.5 to track which memories have been
-- processed for embedding-based link prediction.

CREATE TABLE IF NOT EXISTS jepa_queried_memories (
  memory_id BIGINT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jepa_queried_at ON jepa_queried_memories(queried_at);
