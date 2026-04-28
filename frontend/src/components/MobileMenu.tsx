'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Menu, X, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/authStore';
import { docsNavGroups, docsTocByPath } from './home/docsNavigation';

const publicLinks = [
  { label: 'Product', href: '/docs/product' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Pricing', href: '/docs/pricing' },
  { label: 'Docs', href: '/docs' },
];

const MENU_ANIMATION_MS = 350;

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { initialized, isAuthenticated, user } = useAuthStore();
  const normalizedPath = pathname || '/';
  const isDocsRoute = normalizedPath === '/docs' || normalizedPath.startsWith('/docs/');
  const currentToc = docsTocByPath[normalizedPath] || docsTocByPath['/docs'];

  const displayName = user?.username || user?.email || 'User';
  const displayRole = user?.roles?.[0] || 'Member';

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (enterFrameRef.current) {
        cancelAnimationFrame(enterFrameRef.current);
      }
    };
  }, []);

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (enterFrameRef.current) {
      cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }
    setIsClosing(false);
    setHasEntered(false);
    setIsOpen(true);
    enterFrameRef.current = requestAnimationFrame(() => {
      setHasEntered(true);
      enterFrameRef.current = null;
    });
  };

  const finishClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(false);
    setIsClosing(false);
    setHasEntered(false);
  };

  const closeMenu = ({ immediate = false }: { immediate?: boolean } = {}) => {
    if (!isOpen || isClosing) return;
    if (immediate) {
      finishClose();
      return;
    }
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      finishClose();
    }, MENU_ANIMATION_MS);
  };

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  };

  const handleLoginClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      router.push('/profile');
      return;
    }
    router.push('/login');
  };

  const handleGetStartedClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      router.push('/tasks');
      return;
    }
    router.push('/login');
  };

  return (
    <>
      <button
        onClick={toggleMenu}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
        aria-label="Toggle menu"
      >
        {isOpen && !isClosing ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <>
          <div
            className={`fixed inset-0 z-40 transition-opacity duration-[350ms] ease-out ${
              isDocsRoute ? 'bg-black/40' : 'bg-black/30 backdrop-blur-sm'
            } ${isClosing ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
            onClick={() => closeMenu()}
          />

          {isDocsRoute ? (
            <aside
              className={`fixed inset-y-0 left-0 z-50 w-[min(82vw,360px)] overflow-y-auto bg-white px-6 py-6 shadow-2xl transition-transform duration-[350ms] ease-out [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                isClosing || !hasEntered ? '-translate-x-full' : 'translate-x-0'
              }`}
            >
              <div className="mb-8 flex items-center justify-between">
                <Link
                  href="/docs"
                  className="flex items-center gap-2 font-semibold text-brand-teal"
                  onClick={() => closeMenu({ immediate: true })}
                >
                  <BookOpen className="h-4 w-4" />
                  Documentation
                </Link>
                <button
                  type="button"
                  onClick={() => closeMenu()}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close documentation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-7" aria-label="Documentation navigation">
                {docsNavGroups.map((group) => (
                  <div key={group.title}>
                    <h2 className="mb-2 px-1 text-sm font-semibold text-gray-400">{group.title}</h2>
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = item.href === normalizedPath;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={`flex items-center rounded-lg px-1 py-2 text-lg transition ${
                                isActive ? 'font-semibold text-brand-teal' : 'text-gray-900 hover:text-brand-teal'
                              }`}
                              onClick={() => closeMenu({ immediate: true })}
                            >
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              <div className="mt-8 border-t border-gray-200 pt-7">
                <h2 className="mb-2 px-1 text-sm font-semibold text-gray-400">On this page</h2>
                <nav aria-label="Table of contents">
                  <ul className="space-y-1">
                    {currentToc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className="block rounded-lg px-1 py-2 text-base text-gray-700 transition hover:text-brand-teal"
                          onClick={() => closeMenu({ immediate: true })}
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>

              <div className="mt-8 border-t border-gray-200 pt-7 space-y-3">
                {isAuthenticated ? (
                  <button
                    onClick={handleLoginClick}
                    className="block w-full rounded-full border border-brand-teal/40 px-6 py-3 text-center font-medium text-brand-teal transition hover:bg-brand-teal/5"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{displayName}</span>
                      <span className="text-xs text-gray-500">{displayRole}</span>
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleLoginClick}
                    className="block w-full rounded-full border border-brand-teal/40 px-6 py-3 text-center font-medium text-brand-teal transition hover:bg-brand-teal/5"
                  >
                    Log in
                  </button>
                )}
                <button
                  onClick={handleGetStartedClick}
                  className="block w-full rounded-full bg-brand-gradient px-6 py-3 text-center font-medium text-white transition hover:saturate-150 glow-brand"
                >
                  Get Started
                </button>
              </div>
            </aside>
          ) : (
            <div
              className={`absolute top-full left-0 right-0 z-50 border-b border-gray-200 bg-white/95 shadow-2xl backdrop-blur-xl transition duration-[350ms] ease-out ${
                isClosing || !hasEntered ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
              }`}
            >
              <nav className="px-6 py-4 space-y-4">
                {publicLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-gray-600 hover:text-brand-teal py-2 border-b border-gray-100 transition"
                    onClick={() => closeMenu({ immediate: true })}
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="pt-4 space-y-3">
                  {isAuthenticated ? (
                    <button
                      onClick={handleLoginClick}
                      className="block w-full px-6 py-3 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/5 transition text-center font-medium"
                    >
                      <span className="inline-flex items-center gap-2 justify-center">
                        <User className="w-4 h-4" />
                        <span>{displayName}</span>
                        <span className="text-xs text-gray-500">{displayRole}</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={handleLoginClick}
                      className="block w-full px-6 py-3 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/5 transition text-center font-medium"
                    >
                      Log in
                    </button>
                  )}
                  <button
                    onClick={handleGetStartedClick}
                    className="block w-full px-6 py-3 bg-brand-gradient text-white rounded-full hover:saturate-150 transition text-center font-medium glow-brand"
                  >
                    Get Started
                  </button>
                </div>
              </nav>
            </div>
          )}
        </>
      )}
    </>
  );
}
