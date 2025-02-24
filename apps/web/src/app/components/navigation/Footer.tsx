import { Separator } from '../ui/separator';
import Image from 'next/image';

const Footer = () => {

  const attributes = [
    { id: 'email', key: 'e-post', value: 'hs@tihlde.org' },
    { id: 'location', key: 'lokasjon', value: 'c/o IDI NTNU' },
    { id: 'orgNumber', key: 'organisasjonsnummer', value: '989 684 183' },
  ];

  function someAnalytics(link: string): void {
    console.log(`User clicked on link: ${link}`);
  }

  return (
    <div className='pt-6 pb-32 md:py-20 px-12 md:px-40 text-white border-t space-y-12'>
      <div className='flex flex-col space-y-12 lg:space-y-0 lg:flex-row md:justify-between'>
        <div className='order-last lg:order-first space-y-4 lg:w-[250px]'>
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
        <div>
          <div className='space-y-4'>
            <Separator className='bg-white' />
            <div className='grid grid-cols-3 gap-y-6 lg:flex lg:items-center lg:space-x-8'>
            </div>
          </div>
        </div>

        <div className='lg:w-[250px] pb-12 lg:pb-0'>
          <div className='space-y-1 mb-4'>
            <h1 className='text-3xl font-semibold text-center'>Samarbeid</h1>
            <Separator className='bg-white' />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
