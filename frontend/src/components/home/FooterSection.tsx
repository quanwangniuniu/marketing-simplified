import React from 'react';

export default function FooterSection() {
  return (
    <>
      {/* Footer - Desktop */}
      <footer className="hidden md:block bg-white border-t border-gray-200 pt-16 pb-4 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start mb-4">
            {/* Logo and Email */}
            <div className="mb-4 md:mb-0 md:ml-32">
              <img
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                className="h-20 w-auto mb-2"
              />
              <p className="text-gray-600 mb-6 text-left">One platform.<br />Every stage.</p>
              <div className="relative w-fit mt-10">
                <input
                  type="email"
                  placeholder="Enter Your Email"
                  className="w-64 px-4 pr-24 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-teal text-left"
                />
                <button className="absolute right-1 top-1/2 -translate-y-1/2 px-4 py-2 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all text-sm">
                  Submit
                </button>
              </div>
            </div>

            {/* Four Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:-ml-24">
              {/* Product */}
              <div>
                <h4 className="font-normal text-gray-900 mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><a href="#features" className="text-gray-600 hover:text-gray-900">Features</a></li>
                  <li><a href="#how-it-works" className="text-gray-600 hover:text-gray-900">How it works</a></li>
                  <li><a href="#solutions" className="text-gray-600 hover:text-gray-900">Solutions</a></li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="font-normal text-gray-900 mb-4">Resources</h4>
                <ul className="space-y-2">
                  <li><span className="text-gray-600">Blog</span></li>
                  <li><span className="text-gray-600">Case Studies</span></li>
                  <li><span className="text-gray-600">Guides</span></li>
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="font-normal text-gray-900 mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><span className="text-gray-600">About</span></li>
                  <li><span className="text-gray-600">Contact us</span></li>
                  <li><span className="text-gray-600">Careers</span></li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="font-normal text-gray-900 mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><span className="text-gray-600">Privacy Policy</span></li>
                  <li><span className="text-gray-600">Terms of Service</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Footer - Mobile */}
      <footer className="block md:hidden bg-white border-t border-gray-200 pt-10 pb-4 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Logo and Email */}
          <div className="mb-8 text-center">
            <img
              src="/marketing_simplified_logo.png"
              alt="Marketing Simplified Logo"
              className="h-16 w-auto mb-2 mx-auto"
            />
            <p className="text-gray-600 mb-10">One platform. Every stage.</p>
            <div className="relative w-full max-w-sm mx-auto mt-10">
              <input
                type="email"
                placeholder="Enter Your Email"
                className="w-full px-4 pr-24 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-teal text-sm"
              />
              <button className="absolute right-1 top-1/2 -translate-y-1/2 px-4 py-2 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all text-sm">
                Submit
              </button>
            </div>
          </div>

          {/* Navigation Links - 2x2 Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* Product */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-600 hover:text-gray-900 text-sm">Features</a></li>
                <li><a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm">How it works</a></li>
                <li><a href="#solutions" className="text-gray-600 hover:text-gray-900 text-sm">Solutions</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Resources</h4>
              <ul className="space-y-2">
                <li><span className="text-gray-600 text-sm">Blog</span></li>
                <li><span className="text-gray-600 text-sm">Case Studies</span></li>
                <li><span className="text-gray-600 text-sm">Guides</span></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Company</h4>
              <ul className="space-y-2">
                <li><span className="text-gray-600 text-sm">About</span></li>
                <li><span className="text-gray-600 text-sm">Contact us</span></li>
                <li><span className="text-gray-600 text-sm">Careers</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Legal</h4>
              <ul className="space-y-2">
                <li><span className="text-gray-600 text-sm">Privacy Policy</span></li>
                <li><span className="text-gray-600 text-sm">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">© 2026 Marketing Simplified. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
