import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div
      style={{ width: "200px", borderRight: "1px solid #ccc", height: "100vh", padding: "20px" }}
    >
      <h2>Breeze</h2>
      <nav>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>
            <Link to="/">Dashboard</Link>
          </li>
          <li>
            <Link to="/profile">Profile</Link>
          </li>
          <li>
            <Link to="/settings">Settings</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Sidebar;
