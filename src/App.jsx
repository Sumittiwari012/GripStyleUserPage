import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MallHomepage from './Components/MallHomePage'
import UserPage from './Components/UserPage/UserPage'
import SupplierLoginPage from './Components/Supplier/SupplierLoginPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MallHomepage />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/supplier" element={<SupplierLoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App