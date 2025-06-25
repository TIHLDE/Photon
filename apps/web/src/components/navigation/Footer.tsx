import { Separator } from '../ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import TihldeLogo from '../miscellaneous/TihldeLogo';
import { FaInstagram, FaFacebookF, FaTwitter, FaDiscord, FaSnapchatGhost } from 'react-icons/fa';
import { SiNotion } from 'react-icons/si';

const Footer = () => {
  const attributes = [
    { id: 'email', key: 'e-post', value: 'hs@tihlde.org' },
    { id: 'location', key: 'lokasjon', value: 'c/o IDI NTNU' },
    { id: 'orgNumber', key: 'organisasjonsnummer', value: '989 684 183' },
  ];

  const socials = [
    { id: 'instagram', icon: <FaInstagram size={24} />, href: 'https://instagram.com/tihlde' },
    { id: 'facebook', icon: <FaFacebookF size={24} />, href: 'https://facebook.com/tihlde' },
    { id: 'x', icon: <FaTwitter size={24} />, href: 'https://x.com/tihlde' },
    { id: 'notion', icon: <SiNotion size={24} />, href: 'https://www.notion.so/tihlde/invite/442710f897b596ecd4f8e078cb25fcf76045125a' },
    { id: 'discord', icon: <FaDiscord size={24} />, href: 'https://discord.gg/HNt5XQdyxy' },
    { id: 'snapchat', icon: <FaSnapchatGhost size={24} />, href: 'https://www.snapchat.com/add/tihldesnap' },
  ];

  return (
    <div className='pt-6 pb-32 md:py-20 px-12 md:px-40 text-white space-y-12'>
      <div className='flex flex-col space-y-12 lg:space-y-0 lg:flex-row md:justify-between'>
        <div>
          <div className='space-y-4'>
            <Link href="/" aria-label="Til forsiden" className="text-primary font-bold text-2xl flex items-center gap-2">
              <TihldeLogo size="large" className="w-44 h-auto" />
            </Link>
          </div>
        </div>

        <div className='space-y-4 lg:w-[250px]'>
          <div className='space-y-1'>
            <h1 className='text-3xl font-semibold text-center'>Kontakt</h1>
            <Separator className='bg-white' />
          </div>
          {attributes.map((attribute) => (
            <div className='text-center' key={attribute.id}>
              <h1 className='font-semibold uppercase'>{attribute.key}</h1>
              <h1>{attribute.value}</h1>
            </div>
          ))}
        </div>

        <div className='lg:w-[250px] pb-12 lg:pb-0 space-y-4'>
          <div className='space-y-1 mb-4'>
            <h1 className='text-3xl font-semibold text-center'>Samarbeid</h1>
            <Separator className='bg-white' />
          </div>
          <div>
            <Image
              src={'/nito-logo-hvit.png'}
              alt='NITO Logo'
              width={200}
              height={50}
              className='mx-auto'
            />
          </div>
        </div>
      </div>

      <div className='flex justify-center space-x-6'>
        {socials.map((social) => (
          <Link
            key={social.id}
            href={social.href}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={social.id}
            className='hover:text-primary transition-colors'
          >
            {social.icon}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Footer;
