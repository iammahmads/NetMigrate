import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/overview",          icon: "🏠", label: "Overview" },
  { to: "/codebase",          icon: "🗂️", label: "Codebase" },
  { to: "/migration",         icon: "📋", label: "Migration Plan" },
  { to: "/security",          icon: "🔒", label: "Security" },
  { to: "/dependency-graph",  icon: "🔗", label: "Dependency Graph" },
  { to: "/samples",           icon: "✨", label: "Code Samples" },
];

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>NetMigrate</h1>
          <p>.NET Modernization Dashboard</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
