import Link from "next/link"

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "AI Agent", href: "/agent" },
    { label: "Spreadsheets", href: "/spreadsheets" },
    { label: "Campaigns", href: "/campaigns" },
    { label: "Meetings", href: "/meetings" },
    { label: "Tasks", href: "/tasks" },
    { label: "Calendar", href: "/calendar" },
    { label: "Documents", href: "/notion" },
  ],
  Resources: [
    { label: "Blog", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "Tutorials", href: "#" },
    { label: "API Docs", href: "#" },
    { label: "Community", href: "#" },
    { label: "Templates", href: "/campaigns/templates" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Partners", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
    { label: "Cookies", href: "#" },
  ],
}

export default function FooterSection() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                className="h-20 w-auto"
              />
            </Link>
            <p className="text-gray-500 mb-6 max-w-xs">
              One platform. Every stage. The AI-powered platform for media buyers.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-gray-900 mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href === "#" ? (
                      <span className="text-gray-500 hover:text-gray-900 transition-colors text-sm cursor-default">
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-gray-500 hover:text-gray-900 transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">&copy; 2026 Marketing Simplified. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="hover:text-gray-900 transition-colors cursor-pointer">Status</span>
            <span className="hover:text-gray-900 transition-colors cursor-pointer">Changelog</span>
            <span className="hover:text-gray-900 transition-colors cursor-pointer">Support</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
