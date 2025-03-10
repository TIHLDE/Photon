import { useEffect, useState } from 'react';
import { BellIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import TihldeLogo from '../miscellaneous/TihldeLogo';

const navigationItems = [
  { id: 'home', text: 'Hjem', to: '/' },
  { id: 'linjene', text: 'Linjene', to: '/linjene' },
  { id: 'bedpres', text: 'Bedriftspresentasjon', to: '/bedriftspresentasjon' },
  { id: 'stillinger', text: 'Annonser', to: '/annonser' },
  { id: 'kontakt', text: 'Kontakt oss', to: '/kontakt' },
];

const TopBar: React.FC = () => {
  const [isOnTop, setIsOnTop] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const pathname = usePathname();

  // Initialiser tema basert på lagret preferanse eller systemets dark mode
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme) {
      setIsDarkMode(storedTheme === 'dark');
    } else {
      // Bruk systemets preferanse hvis ingen lagret verdi finnes
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
    }
  }, []);

  // Oppdaterer HTML-taggen og lagrer brukerens valg
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleScroll = () => setIsOnTop(window.scrollY < 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  return (
    <header
      className={clsx(
        'fixed z-30 w-full top-0 transition-all duration-150 backdrop-blur-md',
        isOnTop ? 'bg-transparent' : 'bg-background/95 dark:bg-background/60',
      )}
    >
      <nav className="flex items-center justify-between py-3 px-8 w-full">
        <Link href="/" aria-label="Til forsiden" className="text-primary font-bold text-2xl flex items-center gap-2">
          <TihldeLogo size="large" className="w-44 h-auto" />
        </Link>
        <div className="hidden sm:flex gap-6">
          {navigationItems.map((item) => (
            <Link
              key={item.id}
              href={item.to}
              className={clsx(
                'text-sm font-medium transition-colors hover:text-black dark:hover:text-white',
                pathname === item.to
                  ? 'font-bold text-muted-foreground text-black dark:text-white'
                  : 'text-gray-600 dark:text-gray-400',
              )}
            >
              {item.text}
            </Link>
          ))}
        </div>
        <div className="flex gap-4">
          <button type="button" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {isDarkMode ? (
              <SunIcon className="h-6 w-6 cursor-pointer text-gray-600 dark:text-gray-300" />
            ) : (
              <MoonIcon className="h-6 w-6 cursor-pointer text-gray-600 dark:text-gray-300" />
            )}
          </button>
          <BellIcon className="h-6 w-6 cursor-pointer text-gray-600 dark:text-gray-300" />
        </div>
      </nav>
    </header>
  );
};

export default TopBar;
