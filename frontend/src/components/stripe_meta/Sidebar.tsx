'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'organization', label: 'My Organization' },
    { id: 'subscription', label: 'Subscription' },
  ];

  return (
    <div className="w-64 border-r border-gray-200 pr-6">
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === item.id
                ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-[#3CCED7] font-medium shadow-sm border border-[#3CCED7]/30'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
