import type { ReactNode } from 'react';
import { Menu, ScanBarcode } from 'lucide-react';
import { APP_NAME } from '../../lib/config';
import { SearchBar } from './SearchBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  showBarcodes: boolean;
  onToggleBarcodes: () => void;
}

export function AppShell({
  sidebar,
  children,
  sidebarOpen,
  onToggleSidebar,
  search,
  onSearchChange,
  showBarcodes,
  onToggleBarcodes,
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
        <button
          type="button"
          className={`${styles.barcodeToggle} ${
            showBarcodes ? styles.barcodeToggleOn : ''
          }`}
          onClick={onToggleBarcodes}
          aria-pressed={showBarcodes}
          aria-label={showBarcodes ? 'Hide barcodes' : 'Show barcodes'}
          title={showBarcodes ? 'Hide barcodes' : 'Show barcodes'}
        >
          <ScanBarcode size={18} />
        </button>
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
