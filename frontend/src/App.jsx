import { Routes, Route } from 'react-router-dom'

function Login() {
  return <h1>LOGIN PAGE WORKING</h1>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App
