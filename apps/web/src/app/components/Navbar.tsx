import { BellIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const Navbar: React.FC = () => {
    const navigationItems = [
        { id: 'home', text: 'Hjem', to: '/', type: 'link' },
        { id: 'linjene', text: 'Linjene', to: '/linjene', type: 'link' },
        { id: 'vervene', text: 'Vervene', to: '/vervene', type: 'link' },
        { id: 'bedpres', text: 'Bedriftspresentasjoner', to: '/bedpres', type: 'link' },
        { id: 'stillinger', text: 'Stillingsannonser', to: '/stillinger', type: 'link' },
        { id: 'kontakt', text: 'Kontakt oss', to: '/kontakt', type: 'link' },
    ];

    return (
        <nav className="flex justify-between items-center p-4 bg-white dark:bg-black text-black dark:text-white">
            <div className="text-2xl font-bold">Logo</div>
            <div className="flex gap-5">
                {navigationItems.map((item, index) => (
                    <Link
                        key={item.id}
                        href={item.to}
                        className="text-gray-400 hover:text-white no-underline text-base transition-colors"
                    >
                        {item.text}
                    </Link>
                ))}
            </div>
            <div className="text-2xl">
                <BellIcon className="h-6 w-6" />
            </div>
        </nav>
    );
};

export default Navbar;
