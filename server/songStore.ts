import pg from 'pg'

export interface StoredSong {
  id: string
  savedAt: number
}

export interface SongStore {
  initialize(): Promise<void>
  list(): Promise<unknown[]>
  put(song: StoredSong, expectedRevision: number): Promise<boolean>
  remove(id: string, expectedRevision: number): Promise<boolean>
  close(): Promise<void>
}

const OWNER = 'salmanrrana'

/** Postgres is the source of truth; the owner is set by the server, never the browser. */
export function createSongStore(connectionString: string): SongStore {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 30_000,
  })
  pool.on('error', (error) =>
    console.error('Postgres connection error:', error),
  )

  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS songs (
          owner_id text NOT NULL,
          song_id text NOT NULL,
          data jsonb NOT NULL,
          saved_at bigint NOT NULL,
          revision integer NOT NULL DEFAULT 1,
          deleted boolean NOT NULL DEFAULT false,
          PRIMARY KEY (owner_id, song_id)
        )
      `)
      await pool.query(
        'ALTER TABLE songs ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1',
      )
      await pool.query(
        'ALTER TABLE songs ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false',
      )
    },
    async list() {
      const result = await pool.query<{
        data: Record<string, unknown>
        revision: number
      }>(
        'SELECT data, revision FROM songs WHERE owner_id = $1 AND deleted = false ORDER BY saved_at DESC, song_id',
        [OWNER],
      )
      return result.rows.map((row) => ({ ...row.data, revision: row.revision }))
    },
    async put(song, expectedRevision) {
      const data = JSON.stringify(song)
      const result =
        expectedRevision === 0
          ? await pool.query(
              `INSERT INTO songs (owner_id, song_id, data, saved_at, revision)
             VALUES ($1, $2, $3::jsonb, $4, 1)
             ON CONFLICT (owner_id, song_id) DO NOTHING`,
              [OWNER, song.id, data, song.savedAt],
            )
          : await pool.query(
              `UPDATE songs SET data = $3::jsonb, saved_at = $4,
                              revision = revision + 1
             WHERE owner_id = $1 AND song_id = $2 AND revision = $5 AND deleted = false`,
              [OWNER, song.id, data, song.savedAt, expectedRevision],
            )
      return result.rowCount === 1
    },
    async remove(id, expectedRevision) {
      const result = await pool.query(
        `UPDATE songs SET data = '{}'::jsonb, deleted = true, revision = revision + 1
         WHERE owner_id = $1 AND song_id = $2 AND revision = $3 AND deleted = false`,
        [OWNER, id, expectedRevision],
      )
      return result.rowCount === 1
    },
    close() {
      return pool.end()
    },
  }
}
