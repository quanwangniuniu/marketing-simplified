"use client";

import Image from "next/image";
import Link from "next/link";

import HeaderSection from "@/components/home/HeaderSection";
import { useAuthStore } from "@/lib/authStore";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { initialized, isAuthenticated, user } = useAuthStore();

  const redirectToLogin = () => {
    window.location.href = "/login";
  };

  const handleLoginClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      window.location.href = "/profile";
      return;
    }
    window.location.href = "/login";
  };

  const handleGetStartedClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      window.location.href = "/tasks";
      return;
    }
    window.location.href = "/login";
  };

  const displayName = user?.username || user?.email || "User";
  const displayRole = user?.roles?.[0] || "Member";

  return (
    <div className="not-found-page flex min-h-screen flex-col bg-white">
      <HeaderSection
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        displayRole={displayRole}
        onLoginClick={handleLoginClick}
        onGetStartedClick={handleGetStartedClick}
        onRedirectToLogin={redirectToLogin}
      />

      <main className="flex flex-1 items-center justify-center px-6 py-6 md:px-10 md:py-8">
        <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
          <div className="max-w-xl text-black">
            <h2 className="whitespace-nowrap text-3xl font-normal leading-tight text-black md:text-5xl">
              Something&apos;s wrong here...
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-slate-700 md:text-2xl">
              We can&apos;t find the page you&apos;re looking for. Check out our Help Center or head back to home.
            </p>
            <div className="mt-8 flex items-center gap-3 md:mt-10 md:gap-4">
              <Button
                asChild
                variant="outline"
                className="h-10 min-w-[130px] rounded-full border border-teal-700/40 bg-transparent px-6 text-base text-teal-700 shadow-none hover:bg-teal-50 hover:text-teal-700"
              >
                <Link href="#">Help</Link>
              </Button>
              <Button
                asChild
                className="h-10 min-w-[130px] rounded-full bg-brand-gradient px-6 text-base text-white shadow-none hover:saturate-150"
              >
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>

          <div className="flex justify-center overflow-hidden md:justify-end">
            <Image
              src="/not-found/question-image.png"
              alt="Question mark illustration"
              width={674}
              height={1200}
              priority
              className="h-auto max-h-[46vh] w-auto -translate-x-[2px] object-contain md:max-h-[54vh]"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
