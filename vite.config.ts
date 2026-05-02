import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      // Allow Cloudflare Turnstile to create Trusted Types policy in dev
      'Content-Security-Policy': "trusted-types goog#html ymiGc5 default",
    },
  },
})
