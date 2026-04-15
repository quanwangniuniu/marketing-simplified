import React from 'react';
import Image from 'next/image';

export default function FormContainer({ children, title, subtitle }) {
  return (
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <div className="text-center mb-8">
            <div className="flex flex-col justify-center mb-4 items-center">
              <Image
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                width={400}
                height={100}
                className="h-20 w-auto"
                priority
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
          </div>
          
          {children}
        </div>
      </div>
  );
}