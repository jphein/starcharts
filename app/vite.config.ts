import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hosted at https://starcharts.jphe.in (custom domain via app/public/CNAME),
// so base is "/". For raw https://jphein.github.io/starcharts/ this would be "/starcharts/".
export default defineConfig({
  base: '/',
  plugins: [react()],
})
