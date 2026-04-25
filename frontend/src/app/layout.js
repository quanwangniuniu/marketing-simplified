import "./globals.css";
// import 'highlight.js/styles/atom-one-dark.min.css';
import { AuthProvider } from '../components/providers/AuthProvider';
import { ToasterProvider } from '../components/providers/ToasterProvider';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import OnboardingGate from '../components/onboarding/OnboardingGate';

export const metadata = {
  title: "Marketing Simplified - Campaign Management",
  description: "Professional advertising campaign management platform",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
      </head>
      <body>
        <AuthProvider>
          <OnboardingProvider>
            <OnboardingGate>
              {children}
            </OnboardingGate>
          </OnboardingProvider>
        </AuthProvider>
        <ToasterProvider />
      </body>
    </html>
  );
}
