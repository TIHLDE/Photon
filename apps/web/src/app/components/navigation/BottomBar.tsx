import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { HomeIcon, AcademicCapIcon, PresentationChartBarIcon, BriefcaseIcon, PhoneIcon } from '@heroicons/react/24/outline';

const navigationItems = [
  { id: 'home', text: 'Hjem', to: '/', icon: <HomeIcon className="h-5 w-5" /> },
  { id: 'bedpres', text: 'Bedriftspresentasjoner', to: '/bedpres', icon: <PresentationChartBarIcon className="h-5 w-5" /> },
  { id: 'linjene', text: 'Linjene', to: '/linjene', icon: <AcademicCapIcon className="h-5 w-5" /> },
];

const BottomBar: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 w-full z-30 bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-8 py-2">
        {navigationItems.map((navigationItem) => (
          <Link
            key={navigationItem.id}
            href={navigationItem.to}
            className={clsx(
              'flex flex-col items-center text-xs font-medium transition-colors',
              pathname === navigationItem.to ? 'font-bold text-primary' : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {navigationItem.icon}
            <span>{navigationItem.text}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BottomBar;
