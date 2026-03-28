import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const SCENE_SPEC_PATH = path.resolve(__dirname, '../../blender/scene_spec.json')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const TINYFISH_API_KEY = env.TINYFISH_API_KEY || ''

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'framecrawler-bridge',
        configureServer(server) {
          // POST /api/push-scene — writes SceneSpec JSON to disk for Blender addon
          server.middlewares.use('/api/push-scene', (req, res) => {
            if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return }
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              try {
                JSON.parse(body)
                fs.mkdirSync(path.dirname(SCENE_SPEC_PATH), { recursive: true })
                fs.writeFileSync(SCENE_SPEC_PATH, body)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, path: SCENE_SPEC_PATH }))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: String(e) }))
              }
            })
          })

          // GET /api/scene-spec
          server.middlewares.use('/api/scene-spec', (req, res) => {
            if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return }
            const exists = fs.existsSync(SCENE_SPEC_PATH)
            const mtime = exists ? fs.statSync(SCENE_SPEC_PATH).mtime.toISOString() : null
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ exists, path: SCENE_SPEC_PATH, mtime }))
          })

          // POST /api/tinyfish/run-sse — proxy to TinyFish SSE endpoint
          server.middlewares.use('/api/tinyfish/run-sse', (req, res) => {
            if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return }
            if (!TINYFISH_API_KEY) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'TINYFISH_API_KEY not set' }))
              return
            }

            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body)
                const tfRes = await fetch('https://agent.tinyfish.ai/v1/automation/run-sse', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': TINYFISH_API_KEY,
                  },
                  body: JSON.stringify({
                    goal: payload.goal,
                    url: payload.url || undefined,
                  }),
                })

                if (!tfRes.ok) {
                  res.writeHead(tfRes.status, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ error: `TinyFish returned ${tfRes.status}`, body: await tfRes.text() }))
                  return
                }

                // Stream SSE back to the client
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'Connection': 'keep-alive',
                  'X-Accel-Buffering': 'no',
                })

                const reader = tfRes.body?.getReader()
                if (!reader) { res.end(); return }

                const decoder = new TextDecoder()
                const pump = async () => {
                  try {
                    while (true) {
                      const { done, value } = await reader.read()
                      if (done) break
                      const chunk = decoder.decode(value, { stream: true })
                      res.write(chunk)
                    }
                  } catch {
                    // stream closed
                  }
                  res.end()
                }

                req.on('close', () => { reader.cancel().catch(() => {}) })
                pump()
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
          })

          // POST /api/tinyfish/run-async — fire and forget, returns run_id
          server.middlewares.use('/api/tinyfish/run-async', (req, res) => {
            if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return }
            if (!TINYFISH_API_KEY) { res.writeHead(500); res.end(JSON.stringify({ error: 'No API key' })); return }

            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body)
                const tfRes = await fetch('https://agent.tinyfish.ai/v1/automation/run-async', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-API-Key': TINYFISH_API_KEY },
                  body: JSON.stringify({ goal: payload.goal, url: payload.url || undefined }),
                })
                const data = await tfRes.json()
                res.writeHead(tfRes.status, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(data))
              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
          })

          // GET /api/tinyfish/runs/* — poll run status
          // POST /api/tinyfish/runs/*/cancel — cancel a run
          server.middlewares.use('/api/tinyfish/runs/', (req, res) => {
            if (!TINYFISH_API_KEY) { res.writeHead(500); res.end(JSON.stringify({ error: 'No API key' })); return }

            const urlPath = req.url?.replace(/^\//, '') || ''
            const cancelMatch = urlPath.match(/^(.+)\/cancel$/)

            if (cancelMatch && req.method === 'POST') {
              const runId = cancelMatch[1]
              fetch(`https://agent.tinyfish.ai/v1/runs/${runId}/cancel`, {
                method: 'POST',
                headers: { 'X-API-Key': TINYFISH_API_KEY },
              }).then(async (tfRes) => {
                const data = await tfRes.json()
                res.writeHead(tfRes.status, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(data))
              }).catch((e) => {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: String(e) }))
              })
              return
            }

            if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return }

            const runId = urlPath
            if (!runId) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing run_id' })); return }

            fetch(`https://agent.tinyfish.ai/v1/runs/${runId}`, {
              headers: { 'X-API-Key': TINYFISH_API_KEY },
            }).then(async (tfRes) => {
              const data = await tfRes.json()
              res.writeHead(tfRes.status, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify(data))
            }).catch((e) => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: String(e) }))
            })
          })
        },
      },
    ],
    server: {
      port: 5174,
    },
  }
})
