import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Home } from './ui/screens/Home';
import { LocalPlay, LocalSetup } from './ui/screens/LocalPlay';
import { CreateRoom, JoinRoom, Room } from './ui/screens/Rooms';
import { Settings } from './ui/screens/Settings';
import { Guide } from './ui/screens/Guide';
import { Toaster } from './ui/components/ui';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<LocalPlay />} />
        <Route path="/play/new" element={<LocalSetup />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/join/:code" element={<JoinRedirect />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}

/** Invite links (#/join/CODE) go straight to the room, which asks for a name if needed. */
function JoinRedirect() {
  const { code = '' } = useParams();
  return <Navigate to={`/room/${code.toUpperCase()}`} replace />;
}
