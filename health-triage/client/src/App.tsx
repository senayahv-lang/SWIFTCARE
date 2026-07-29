import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Triage from './pages/Triage';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/triage" element={<Triage />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Layout>
  );
}
