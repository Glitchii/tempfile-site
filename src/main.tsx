import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import './assets/styles/css/index.css'
import Header from './components/Header'
import Api from './pages/Api'
import ContactRedirect from './pages/ContactRedirect'
import Delete from './pages/Delete'
import Home from './pages/Home'

createRoot(document.body).render(
  <StrictMode>
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/delete" element={<Delete />} />
        <Route path="/delete/:name" element={<Delete />} />
        <Route path="/api" element={<Api />} />
        <Route path="/contact" element={<ContactRedirect />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
