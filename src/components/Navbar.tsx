import { useState, useEffect } from 'react'
import {
  Dialog,
  Disclosure,
  Popover,
  Transition,
} from '@headlessui/react'
import {
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { ChevronDownIcon, PhoneIcon } from '@heroicons/react/20/solid'
import {
  FaTruck,
  FaShieldAlt,
  FaMotorcycle,
  FaDoorOpen,
  FaLaptop,
  FaGraduationCap,
  FaSnowflake,
  FaCar,
  FaHandshake,
  FaUserShield,
  FaMapMarkedAlt,
  FaStore,
  FaGavel,
  FaWeightHanging,
  FaInfoCircle,
  FaStar,
  FaChartLine,
  FaUsers,
  FaQuestionCircle,
  FaDollarSign,
  FaMap,
  FaHeadset,
  FaFacebookMessenger,
  FaWhatsapp
} from 'react-icons/fa'
import logoweb from '../../public/img/logo-cayad.webp'
import '../styles/navbar.css'

const howItWork = [
  { description: 'How To Ship a Car', href: '/how-auto-transport-works/', icon: FaQuestionCircle },
  { description: 'Car Shipping Cost', href: '/how-auto-transport-works/how-much-does-it-cost-ship-car/', icon: FaDollarSign },
  { description: 'Cross country car shipping', href: '/how-auto-transport-works/ship-car-across-country/', icon: FaMapMarkedAlt },
]

const weOffer = [
  { description: 'Door to door transport', href: '/for-individuals/door-to-door/', icon: FaDoorOpen },
  { description: 'Open car transport', href: '/for-individuals/open-car-transport/', icon: FaTruck },
  { description: 'Enclosed auto transport', href: '/for-individuals/enclosed-auto-transport/', icon: FaShieldAlt },
  { description: 'Motorcycle shipping', href: '/for-individuals/motorcycle-shipping/', icon: FaMotorcycle }
]

const weServe = [
  { description: 'Online car buyers', href: '/for-individuals/car-buyers-auto-transport/', icon: FaLaptop },
  { description: 'College students', href: '/for-individuals/students-auto-transport/', icon: FaGraduationCap },
  { description: 'Snowbirds', href: '/for-individuals/snowbirds-auto-transport/', icon: FaSnowflake },
  { description: 'Classic car shipping', href: '/for-individuals/classic-cars-auto-transport/', icon: FaCar },
  { description: 'Car resellers shipping', href: '/for-individuals/car-resellers-auto-transport/', icon: FaHandshake },
  { description: 'Military', href: '/for-individuals/military-auto-transport/', icon: FaUserShield },
  { description: 'Ship cars to another state', href: '/for-individuals/ship-car-to-another-state/', icon: FaMap },
]

const forBusinesses = [
  { description: 'Auto dealerships', href: '/for-businesses/auto-dealers/', icon: FaStore },
  { description: 'Auto auctions', href: '/for-businesses/auto-auctions/', icon: FaGavel },
  { description: 'Heavy haul', href: '/for-businesses/heavy-haul/', icon: FaWeightHanging }
]

const whyUs = [
  { description: 'About Us', href: '/why-us/about-us/', icon: FaInfoCircle },
  { description: 'Reviews', href: '/why-us/reviews/', icon: FaStar },
  { description: 'Growth', href: '/why-us/growth/', icon: FaChartLine },
  { description: 'Our team', href: '/why-us/our-team/', icon: FaUsers },
]

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ')
}

interface NavbarProps {
  cleanMode?: boolean;
}

export default function Navbar({ cleanMode = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [isFunnelMode, setIsFunnelMode] = useState(false);

  // AÑO DINÁMICO
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setCurrentPath(window.location.pathname);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const handleFunnelMode = (e: CustomEvent) => {
      setIsFunnelMode(e.detail?.enabled === true);
    };
    window.addEventListener('navbar-funnel-mode', handleFunnelMode as EventListener);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('navbar-funnel-mode', handleFunnelMode as EventListener);
    };
  }, []);

  const isCleanMode = cleanMode || isFunnelMode;
  const isActive = (path: string) => currentPath.startsWith(path);

  const pathsToCheckForIndividuals = ['/for-individuals', ...weOffer.map(item => item.href), ...weServe.map(item => item.href)];
  const pathsToCheckForIBusinesses = ['/for-businesses', ...forBusinesses.map(item => item.href)];
  const pathsToCheckHowItWork = ['/how-auto-transport-works', ...howItWork.map(item => item.href)];
  const pathsToCheckWhyUs = ['/why-us', ...whyUs.map(item => item.href)];

  const isPopoverIndividualsActive = pathsToCheckForIndividuals.some(path => isActive(path));
  const isPopoverBusinessesActive = pathsToCheckForIBusinesses.some(path => isActive(path));
  const isPopoverWhyUsActive = pathsToCheckWhyUs.some(path => isActive(path));
  const isPopoverHowItWorkActive = pathsToCheckHowItWork.some(path => isActive(path));

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full">
      {!isCleanMode}
      <header
        className={classNames(
          "transition-all duration-300 border-t-[4px] border-[#00a1e1]",
          scrolled ? "bg-white/95 backdrop-blur-md shadow-md py-2" : "bg-white py-4"
        )}
      >
        <nav className="mx-auto flex w-full items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Global">
          <div className="flex items-center gap-4">
            {!isCleanMode && (
              <div className="navbar-mobile-btn">
                <button
                  type="button"
                  className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-700 hover:text-[#00a1e1] transition-colors"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <span className="sr-only">Open main menu</span>
                  <Bars3Icon className="h-8 w-8" aria-hidden="true" />
                </button>
              </div>
            )}

            {isCleanMode ? (
              <div className="-m-1.5 p-1.5">
                <span className="sr-only">Cayad Auto Transport</span>
                <img className="h-10 w-auto sm:h-12" src={logoweb.src} alt="Cayad Logo" width={60} height={60} />
              </div>
            ) : (
              <a href="/" className="-m-1.5 p-1.5 transition-transform hover:scale-105 duration-200">
                <span className="sr-only">Cayad Auto Transport</span>
                <img className="h-10 w-auto sm:h-12" src={logoweb.src} alt="Cayad Logo" width={60} height={60} />
              </a>
            )}
          </div>

          {!isCleanMode && (
            <div className="flex lg:hidden items-center gap-2">
              <a
                href="tel:+14696190747"
                className="h-9 w-9 flex items-center justify-center rounded-md bg-[#005c85] text-white shadow-sm hover:bg-[#004a6b] transition-all active:scale-95"
                aria-label="Call Us"
              >
                <FaHeadset className="h-5 w-5" />
              </a>
              <a
                href="https://api.whatsapp.com/send/?phone=14696190747&text=%F0%9F%8C%90%20Hola%20Cayad%20Team%20quiero%20transportar%20mi%20coche&type=phone_number&app_absent=0"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 flex items-center justify-center rounded-md bg-[#25D366] text-white shadow-sm hover:bg-[#20b858] transition-all active:scale-95"
                aria-label="WhatsApp"
              >
                <FaWhatsapp className="h-5 w-5" />
              </a>
              <a
                href="https://m.me/116222094837969?ref=Hello_Cayad_Team_I_want_to_ship_my_car"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 w-9 flex items-center justify-center rounded-md bg-[#0084FF] text-white shadow-sm hover:bg-[#0074e0] transition-all active:scale-95"
                aria-label="Messenger"
              >
                <FaFacebookMessenger className="h-5 w-5" />
              </a>
            </div>
          )}

          {!isCleanMode && (
            <div className="navbar-desktop-menu">
              <Popover className="relative" onMouseEnter={() => setOpenPopover('how-it-work')} onMouseLeave={() => setOpenPopover(null)}>
                <Popover.Button className={classNames(
                  isPopoverHowItWorkActive ? 'text-[#00a1e1]' : 'text-slate-800',
                  "flex items-center gap-x-1 text-sm font-semibold leading-6 hover:text-[#00a1e1] transition-colors focus:outline-none whitespace-nowrap"
                )}>
                  HOW IT WORKS
                  <ChevronDownIcon className={classNames(openPopover === 'how-it-work' ? 'rotate-180' : '', "h-5 w-5 flex-none text-slate-400 transition-transform duration-200")} aria-hidden="true" />
                </Popover.Button>

                <Transition
                  show={openPopover === 'how-it-work'}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel static className="absolute -left-8 top-full z-10 mt-3 w-screen max-w-xs overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
                    <div className="p-2">
                      {howItWork.map((item) => (
                        <div key={item.description} className="group relative flex items-center gap-x-4 rounded-lg p-3 text-sm leading-6 hover:bg-slate-50 transition-colors">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-all text-slate-400 group-hover:text-[#00a1e1]">
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="flex-auto">
                            <a href={item.href} className="block font-semibold text-slate-900 group-hover:text-[#00a1e1]">
                              {item.description}
                              <span className="absolute inset-0" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Popover.Panel>
                </Transition>
              </Popover>

              <Popover className="relative" onMouseEnter={() => setOpenPopover('individuals')} onMouseLeave={() => setOpenPopover(null)}>
                <Popover.Button className={classNames(
                  isPopoverIndividualsActive ? 'text-[#00a1e1]' : 'text-slate-800',
                  "flex items-center gap-x-1 text-sm font-semibold leading-6 hover:text-[#00a1e1] transition-colors focus:outline-none whitespace-nowrap"
                )}>
                  FOR INDIVIDUALS
                  <ChevronDownIcon className={classNames(openPopover === 'individuals' ? 'rotate-180' : '', "h-5 w-5 flex-none text-slate-400 transition-transform duration-200")} aria-hidden="true" />
                </Popover.Button>

                <Transition
                  show={openPopover === 'individuals'}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel static className="absolute -left-8 top-full z-10 mt-3 w-screen max-w-md overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs font-bold text-[#00a1e1] uppercase tracking-wider">Services</div>
                        {weOffer.map((item) => (
                          <div key={item.description} className="group relative flex items-center gap-x-3 rounded-lg p-2 text-sm leading-6 hover:bg-slate-50 transition-colors">
                            <item.icon className="h-5 w-5 flex-none text-slate-400 group-hover:text-[#00a1e1]" aria-hidden="true" />
                            <a href={item.href} className="block font-medium text-slate-900 group-hover:text-[#00a1e1]">
                              {item.description}
                              <span className="absolute inset-0" />
                            </a>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 bg-slate-50/50">
                        <div className="px-3 py-2 text-xs font-bold text-[#00a1e1] uppercase tracking-wider">Who We Serve</div>
                        {weServe.map((item) => (
                          <div key={item.description} className="group relative flex items-center gap-x-3 rounded-lg p-2 text-sm leading-6 hover:bg-slate-50 transition-colors">
                            <item.icon className="h-5 w-5 flex-none text-slate-400 group-hover:text-[#00a1e1]" aria-hidden="true" />
                            <a href={item.href} className="block font-medium text-slate-900 group-hover:text-[#00a1e1]">
                              {item.description}
                              <span className="absolute inset-0" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Popover.Panel>
                </Transition>
              </Popover>

              <Popover className="relative" onMouseEnter={() => setOpenPopover('businesses')} onMouseLeave={() => setOpenPopover(null)}>
                <Popover.Button className={classNames(
                  isPopoverBusinessesActive ? 'text-[#00a1e1]' : 'text-slate-800',
                  "flex items-center gap-x-1 text-sm font-semibold leading-6 hover:text-[#00a1e1] transition-colors focus:outline-none whitespace-nowrap"
                )}>
                  FOR BUSINESSES
                  <ChevronDownIcon className={classNames(openPopover === 'businesses' ? 'rotate-180' : '', "h-5 w-5 flex-none text-slate-400 transition-transform duration-200")} aria-hidden="true" />
                </Popover.Button>

                <Transition
                  show={openPopover === 'businesses'}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel static className="absolute -left-8 top-full z-10 mt-3 w-screen max-w-xs overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
                    <div className="p-2">
                      {forBusinesses.map((item) => (
                        <div key={item.description} className="group relative flex items-center gap-x-4 rounded-lg p-3 text-sm leading-6 hover:bg-slate-50 transition-colors">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-all text-slate-400 group-hover:text-[#00a1e1]">
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="flex-auto">
                            <a href={item.href} className="block font-semibold text-slate-900 group-hover:text-[#00a1e1]">
                              {item.description}
                              <span className="absolute inset-0" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Popover.Panel>
                </Transition>
              </Popover>

              <Popover className="relative" onMouseEnter={() => setOpenPopover('whyUs')} onMouseLeave={() => setOpenPopover(null)}>
                <Popover.Button className={classNames(
                  isPopoverWhyUsActive ? 'text-[#00a1e1]' : 'text-slate-800',
                  "flex items-center gap-x-1 text-sm font-semibold leading-6 hover:text-[#00a1e1] transition-colors focus:outline-none whitespace-nowrap"
                )}>
                  COMPANY
                  <ChevronDownIcon className={classNames(openPopover === 'whyUs' ? 'rotate-180' : '', "h-5 w-5 flex-none text-slate-400 transition-transform duration-200")} aria-hidden="true" />
                </Popover.Button>

                <Transition
                  show={openPopover === 'whyUs'}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0 translate-y-1"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 translate-y-1"
                >
                  <Popover.Panel static className="absolute -left-8 top-full z-10 mt-3 w-screen max-w-xs overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-900/5">
                    <div className="p-2">
                      {whyUs.map((item) => (
                        <div key={item.description} className="group relative flex items-center gap-x-4 rounded-lg p-3 text-sm leading-6 hover:bg-slate-50 transition-colors">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-all text-slate-400 group-hover:text-[#00a1e1]">
                            <item.icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="flex-auto">
                            <a href={item.href} className="block font-semibold text-slate-900 group-hover:text-[#00a1e1]">
                              {item.description}
                              <span className="absolute inset-0" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Popover.Panel>
                </Transition>
              </Popover>

              <a href="/faqs/" className={classNames(currentPath === '/faqs/' ? 'text-[#00a1e1]' : 'text-slate-800', "text-sm font-semibold leading-6 hover:text-[#00a1e1] transition-colors")}>
                FAQS
              </a>
              <a href="/contact" className={classNames(currentPath === '/contact' ? 'text-btn-blue' : '', "text-sm font-semibold leading-6 text-slate-800 hover:text-[#00a1e1] transition-colors")}>
                CONTACT
              </a>

              <div className="flex items-center pl-4 border-l border-slate-200 ml-4 gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <a
                    href="tel:+14696190747"
                    className="hidden h-10 w-10 flex items-center justify-center rounded-full bg-[#005c85] text-white shadow-md hover:bg-[#004a6b] hover:scale-105 transition-all duration-200"
                    aria-label="Call Support"
                    title="Call Support"
                  >
                    <FaHeadset className="h-5 w-5" />
                  </a>
                  <a
                    href="https://api.whatsapp.com/send/?phone=14696190747&text=%F0%9F%8C%90%20Hola%20Cayad%20Team%20quiero%20transportar%20mi%20coche&type=phone_number&app_absent=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-[#25D366] text-white shadow-md hover:bg-[#20b858] hover:scale-105 transition-all duration-200"
                    aria-label="WhatsApp"
                    title="WhatsApp"
                  >
                    <FaWhatsapp className="h-5 w-5" />
                  </a>
                  <a
                    href="https://m.me/116222094837969?ref=Hello_Cayad_Team_I_want_to_ship_my_car"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-[#0084FF] text-white shadow-md hover:bg-[#0074e0] hover:scale-105 transition-all duration-200"
                    aria-label="Messenger"
                    title="Messenger"
                  >
                    <FaFacebookMessenger className="h-5 w-5" />
                  </a>
                </div>

                <a
                  href="tel:+14696190747"
                  className="group flex items-center gap-2 rounded-full bg-[#00a1e1] px-5 py-2.5 text-white shadow-md transition-all duration-300 hover:bg-[#008cc3] hover:shadow-lg hover:-translate-y-0.5"
                >
                  <PhoneIcon className="h-4 w-4 text-white group-hover:animate-pulse" />
                  <span className="text-sm font-bold tracking-wide">(469) 619-0747</span>
                </a>
              </div>
            </div>
          )}
        </nav >

        {/* Mobile menu */}
        <Dialog as="div" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
          <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" />
          <Dialog.Panel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-slate-900/10 shadow-2xl">
            <div className="flex items-center justify-between">
              <a href="/" className="-m-1.5 p-1.5">
                <span className="sr-only">Cayad Services</span>
                <img className="h-10 w-auto" src={logoweb.src} alt="" />
              </a>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-slate-700 hover:text-[#00a1e1]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-slate-100 flex flex-col min-h-[calc(100vh-80px)]">
                <div className="space-y-2 py-6 flex-1">

                  <Disclosure as="div" className="-mx-3">
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full items-center justify-between rounded-lg py-2 pl-3 pr-3.5 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                          HOW IT WORKS
                          <ChevronDownIcon className={classNames(open ? 'rotate-180' : '', 'h-5 w-5 flex-none transition-transform')} aria-hidden="true" />
                        </Disclosure.Button>
                        <Disclosure.Panel className="mt-2 space-y-1 pl-4">
                          {howItWork.map((item) => (
                            <Disclosure.Button key={item.description} as="a" href={item.href} className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-slate-600 hover:bg-slate-50 hover:text-[#00a1e1]">
                              {item.description}
                            </Disclosure.Button>
                          ))}
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>

                  <Disclosure as="div" className="-mx-3" defaultOpen={isPopoverIndividualsActive}>
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full items-center justify-between rounded-lg py-2 pl-3 pr-3.5 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                          FOR INDIVIDUALS
                          <ChevronDownIcon className={classNames(open ? 'rotate-180' : '', 'h-5 w-5 flex-none transition-transform')} aria-hidden="true" />
                        </Disclosure.Button>
                        <Disclosure.Panel className="mt-2 space-y-1 pl-4">
                          <div className="px-3 py-1 text-xs font-bold text-[#00a1e1] uppercase">Services</div>
                          {weOffer.map((item) => (
                            <Disclosure.Button key={item.description} as="a" href={item.href} className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-slate-600 hover:bg-slate-50 hover:text-[#00a1e1]">
                              {item.description}
                            </Disclosure.Button>
                          ))}
                          <div className="px-3 py-1 mt-2 text-xs font-bold text-[#00a1e1] uppercase">Who We Serve</div>
                          {weServe.map((item) => (
                            <Disclosure.Button key={item.description} as="a" href={item.href} className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-slate-600 hover:bg-slate-50 hover:text-[#00a1e1]">
                              {item.description}
                            </Disclosure.Button>
                          ))}
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>

                  <Disclosure as="div" className="-mx-3" defaultOpen={isPopoverBusinessesActive}>
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full items-center justify-between rounded-lg py-2 pl-3 pr-3.5 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                          FOR BUSINESSES
                          <ChevronDownIcon className={classNames(open ? 'rotate-180' : '', 'h-5 w-5 flex-none transition-transform')} aria-hidden="true" />
                        </Disclosure.Button>
                        <Disclosure.Panel className="mt-2 space-y-1 pl-4">
                          {forBusinesses.map((item) => (
                            <Disclosure.Button key={item.description} as="a" href={item.href} className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-slate-600 hover:bg-slate-50 hover:text-[#00a1e1]">
                              {item.description}
                            </Disclosure.Button>
                          ))}
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>

                  <Disclosure as="div" className="-mx-3" defaultOpen={isPopoverWhyUsActive}>
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex w-full items-center justify-between rounded-lg py-2 pl-3 pr-3.5 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                          COMPANY
                          <ChevronDownIcon className={classNames(open ? 'rotate-180' : '', 'h-5 w-5 flex-none transition-transform')} aria-hidden="true" />
                        </Disclosure.Button>
                        <Disclosure.Panel className="mt-2 space-y-1 pl-4">
                          {whyUs.map((item) => (
                            <Disclosure.Button key={item.description} as="a" href={item.href} className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-slate-600 hover:bg-slate-50 hover:text-[#00a1e1]">
                              {item.description}
                            </Disclosure.Button>
                          ))}
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>

                  <a href="/faqs/" className="-mx-3 block rounded-lg py-2 px-3 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                    FAQS
                  </a>
                  <a href="/contact" className="-mx-3 block rounded-lg py-2 px-3 text-base font-semibold leading-7 text-slate-900 hover:bg-slate-50 hover:text-[#00a1e1]">
                    CONTACT
                  </a>

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <a href="tel:+14696190747" className="flex items-center justify-center gap-2 rounded-lg bg-[#00a1e1] px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-600">
                      <PhoneIcon className="h-5 w-5" />
                      Call (469) 619-0747
                    </a>
                  </div>

                </div>
                <div className="py-6 mt-auto text-center text-xs text-slate-400">
                  <p className="text-[10px] uppercase font-medium tracking-[0.2em] mb-1 text-slate-500">IN GOD WE TRUST</p>
                  <p>&copy; 2023-{currentYear} Cayad Services LLC</p>
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </Dialog >
      </header >
    </div >
  )
}