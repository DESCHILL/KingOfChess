import './App.css';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Landing } from './screens/Landing';
import { Game } from './screens/Game';
import { Rooms } from './screens/Rooms';
import { Computer } from './screens/Computer';
const router = createBrowserRouter([
    { path: "/", element: <Landing /> },
    { path: "/game", element: <Game /> },
    { path: "/rooms", element: <Rooms /> },
    { path: "/computer", element: <Computer /> },
]);
function App() {
    return <RouterProvider router={router}/>;
}
export default App;
