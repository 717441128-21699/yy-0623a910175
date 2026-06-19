import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ImportPage from '@/pages/ImportPage';
import DubbingPage from '@/pages/DubbingPage';
import ExportPage from '@/pages/ExportPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/dubbing" element={<DubbingPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<Navigate to="/import" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
