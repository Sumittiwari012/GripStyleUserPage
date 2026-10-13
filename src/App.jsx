import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MallHomepage from './Components/MallHomePage'
import UserPage from './Components/UserPage/UserPage'
import SupplierLoginPage from './Components/Supplier/SupplierLoginPage'
import PrivacyPolicy from './Components/Legal/PrivacyPolicy'
import TermsOfService from './Components/Legal/TermsOfService'
import DataDeletion from './Components/Legal/DataDeletion'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MallHomepage />} />
        <Route path="/user" element={<UserPage />} />
        <Route path="/supplier" element={<SupplierLoginPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/data-deletion" element={<DataDeletion />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App