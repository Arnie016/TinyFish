import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const SCENE_SPEC_PATH = path.resolve(__dirname, '../../blender/scene_spec.json')

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'framecrawler-bridge',
      configureServer(server) {
        // POST /api/push-scene — writes SceneSpec JSON to disk for Blender addon
        server.middlewares.use('/api/push-scene', (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405)
            res.end('Method not allowed')
            return
          }
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', () => {
            try {
              JSON.parse(body) // validate
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

        // GET /api/scene-spec — check if file exists and return its mtime
        server.middlewares.use('/api/scene-spec', (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405)
            res.end('Method not allowed')
            return
          }
          const exists = fs.existsSync(SCENE_SPEC_PATH)
          const mtime = exists ? fs.statSync(SCENE_SPEC_PATH).mtime.toISOString() : null
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ exists, path: SCENE_SPEC_PATH, mtime }))
        })
      },
    },
  ],
  server: {
    port: 5174,
  },
})
