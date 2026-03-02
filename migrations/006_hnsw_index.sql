-- Migration 006: Add HNSW index for fast vector similarity search
-- Switches from sequential scan to approximate nearest neighbor
-- Reduces vector search from ~2-4s to ~50ms

-- Index on main memory embeddings
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx 
ON memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index on fragment embeddings (for sub-memory precision)
CREATE INDEX IF NOT EXISTS memory_fragments_embedding_hnsw_idx 
ON memory_fragments USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Set probes for recall quality (higher = more accurate, slightly slower)
-- Default ef_search = 40, which is a good balance
ALTER INDEX memories_embedding_hnsw_idx SET (ef_search = 40);
ALTER INDEX memory_fragments_embedding_hnsw_idx SET (ef_search = 40);
