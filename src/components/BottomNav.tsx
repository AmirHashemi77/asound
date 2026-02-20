import { NavLink } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  HiOutlineCog6Tooth,
  HiOutlineHome,
  HiOutlineMusicalNote,
  HiOutlineQueueList
} from "react-icons/hi2";

const navItems: Array<{ to: string; label: string; icon: IconType }> = [
  { to: "/", label: "Library", icon: HiOutlineHome },
  { to: "/playlists", label: "Playlists", icon: HiOutlineQueueList },
  { to: "/player", label: "Player", icon: HiOutlineMusicalNote },
  { to: "/settings", label: "Settings", icon: HiOutlineCog6Tooth }
];

const BottomNav = () => (
  <nav className="safe-bottom glass sticky bottom-0 z-20 mx-3 mb-3 flex items-center justify-around rounded-3xl border border-white/10 px-2 py-2 text-[11px] shadow-soft">
    {navItems.map((item) => {
      const Icon = item.icon;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-w-16 flex-col items-center gap-1 rounded-2xl px-3 py-2 font-medium transition ${
              isActive
                ? "bg-white/10 text-primary shadow-soft"
                : "text-muted hover:bg-white/5 hover:text-primary"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${
                  isActive ? "bg-glow/25 text-white shadow-glow" : "bg-white/10"
                }`}
              >
                <Icon className="text-[18px]" />
              </span>
              <span className="text-[11px] leading-none">{item.label}</span>
            </>
          )}
        </NavLink>
      );
    })}
  </nav>
);

export default BottomNav;
