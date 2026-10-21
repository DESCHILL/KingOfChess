import './App.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Landing } from './screens/Landing';
import { Game } from './screens/Game';
import { Rooms } from './screens/Rooms';
import { Computer } from './screens/Computer';
import { Account } from './screens/Account';
import { History } from './screens/History';
import { AuthProvider } from './components/AuthProvider';
const router = createBrowserRouter([
    { path: "/", element: <Landing /> },
    { path: "/game", element: <Game /> },
    { path: "/rooms", element: <Rooms /> },
    { path: "/computer", element: <Computer /> },
    { path: "/account", element: <Account /> },
    { path: "/history", element: <History /> },
]);
function App() {
    return <AuthProvider><RouterProvider router={router}/></AuthProvider>;
}
export default App;
