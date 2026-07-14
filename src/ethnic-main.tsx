import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Ethnic from './pages/Ethnic'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Ethnic />
  </StrictMode>,
)
