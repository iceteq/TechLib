import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { APP_NAME } from '../../lib/config';
import type { ViewPrefs } from '../../lib/viewPrefs';
import { SearchBar } from './SearchBar';
import { ViewOptionsMenu } from './ViewOptionsMenu';
import styles from './AppShell.module.css';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewPrefs: ViewPrefs;
  onViewPrefsChange: (prefs: ViewPrefs) => void;
}

export function AppShell({
  sidebar,
  children,
  sidebarOpen,
  onToggleSidebar,
  search,
  onSearchChange,
  viewPrefs,
  onViewPrefsChange,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu size={20} />
        </button>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <h1 className={styles.brandTitle}>{APP_NAME}</h1>
        </div>
        <SearchBar value={search} onChange={onSearchChange} />
        <ViewOptionsMenu prefs={viewPrefs} onChange={onViewPrefsChange} />
      </header>

      <div className={styles.body}>
        <aside
          className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}
        >
          {sidebar}
        </aside>
        {sidebarOpen && (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close sidebar"
            onClick={onToggleSidebar}
          />
        )}
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
