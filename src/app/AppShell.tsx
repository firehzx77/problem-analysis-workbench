import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { isSettingsReady, settingsBlockReason } from "@/domain/settings";
import { useStore } from "@/app/store";

export function AppShell() {
  const { settings, find } = useStore();
  const { caseId } = useParams();
  const location = useLocation();
  const current = caseId ? find(caseId) : null;
  const ready = isSettingsReady(settings);
  const blocked = settingsBlockReason(settings);
  const inWorkspace = location.pathname.startsWith("/case/");

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <strong>三生工作台</strong>
          <span>问题分析与解决</span>
        </Link>
        {inWorkspace && current ? (
          <div className="topbar-title">{current.title}</div>
        ) : (
          <div className="topbar-title" />
        )}
        <div className="topbar-actions">
          <NavLink to="/settings" className="btn btn-ghost">
            设置
          </NavLink>
        </div>
      </header>
      {!ready && location.pathname !== "/settings" ? (
        <div className="notice" style={{ margin: 0, border: 0, borderBottom: "1px solid var(--line)" }}>
          {blocked}现在可以选题和填结构；补全后到{" "}
          <Link to="/settings">设置</Link> 保存。
        </div>
      ) : null}
      <Outlet />
    </div>
  );
}
