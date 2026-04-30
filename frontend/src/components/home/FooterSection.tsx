import Link from "next/link"
import Image from "next/image"

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Home", href: "/" },
    { label: "Product", href: "/docs/product" },
    { label: "Solutions", href: "/solutions" },
    { label: "Pricing", href: "/docs/pricing" },
  ],
  Resources: [
    { label: "Docs", href: "/docs" },
    { label: "Workflow Guides", href: "/docs" },
    { label: "Policy Guide", href: "/docs/policy" },
    { label: "Pricing Q&A", href: "/docs/pricing" },
  ],
  Company: [
    { label: "Start Trial", href: "/login" },
    { label: "Contact", href: "/docs" },
    { label: "Platform Overview", href: "/docs/product" },
  ],
  Legal: [
    { label: "Policy", href: "/docs/policy" },
    { label: "Data Use", href: "/docs/policy" },
    { label: "Platform Responsibilities", href: "/docs/policy" },
  ],
}

export default function FooterSection() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-10 sm:py-14 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-10 gap-y-10">
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                width={898}
                height={423}
                sizes="212px"
                className="h-14 w-auto sm:h-16 lg:h-20"
              />
            </Link>
            <p className="mb-8 max-w-sm text-base leading-7 text-gray-600">
              Plan campaigns, coordinate work, and turn performance signals into decisions your media team can act on.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-gray-900 mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href === "#" ? (
                      <span className="cursor-default text-sm leading-6 text-gray-600 transition-colors hover:text-gray-950">
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm leading-6 text-gray-600 transition-colors hover:text-gray-950"
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
        </div>
      </div>
    </footer>
  )
}
