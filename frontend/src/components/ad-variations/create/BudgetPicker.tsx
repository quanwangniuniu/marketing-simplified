'use client';

interface Props {
  choice: string;
  custom: string;
  onChange: (choice: string, custom: string) => void;
}

const OPTIONS = [
  { label: '$25/d', value: '25' },
  { label: '$50/d', value: '50' },
  { label: '$100/d', value: '100' },
  { label: '$250/d', value: '250' },
  { label: '$500/d', value: '500' },
  { label: 'Custom', value: 'custom' },
];

export default function BudgetPicker({ choice, custom, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => {
          const active = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value, custom)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                active
                  ? 'border-transparent bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white shadow-sm'
                  : 'border-transparent bg-gray-100 text-gray-700 hover:border-[#3CCED7]/40 hover:bg-white'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {choice === 'custom' && (
        <div className="relative">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[14px] text-gray-400">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={custom}
            onChange={(e) => onChange(choice, e.target.value)}
            placeholder="0"
            className="w-full border-0 border-b border-gray-200 bg-transparent py-1 pl-5 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-[#3CCED7]"
          />
        </div>
      )}
    </div>
  );
}
