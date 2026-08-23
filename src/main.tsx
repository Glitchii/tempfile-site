import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import './assets/styles/css/index.css'
import './assets/styles/css/auth.css'
import './assets/styles/css/error.css'
import Header from './components/Header'
import Api from './pages/Api'
import Auth from './pages/Auth'
import ContactRedirect from './pages/ContactRedirect'
import Delete from './pages/Delete'
import ErrorPage from './pages/ErrorPage'
import Home from './pages/Home'

createRoot(document.body).render(
  <StrictMode>
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/delete" element={<Delete />} />
        <Route path="/delete/:name" element={<Delete />} />
        <Route path="/del" element={<Delete />} />
        <Route path="/del/:name" element={<Delete />} />
        <Route path="/auth/:name" element={<Auth />} />
        <Route path="/error/:status" element={<ErrorPage />} />
        <Route path="/forbidden" element={<ErrorPage status={403} />} />
        <Route path="/forbidden/:code" element={<ErrorPage status={403} />} />
        <Route path="/api" element={<Api />} />
        <Route path="/contact" element={<ContactRedirect />} />
        <Route path="*" element={<ErrorPage status={404} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
