'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  onRename: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  children: ReactNode;
}

export default function SheetTabContextMenu({ onRename, onDelete, canDelete = true, children }: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="end"
          className="z-50 min-w-[10rem] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <div className="h-[3px] w-full bg-gradient-to-r from-[#3CCED7] to-[#A6E661]" />
          <div className="py-1">
            <DropdownMenu.Item
              onSelect={() => onRename()}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 outline-none transition data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900"
            >
              <Pencil className="h-3 w-3 text-gray-400" aria-hidden="true" />
              <span>Rename</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={!canDelete}
              onSelect={() => {
                if (canDelete) onDelete();
              }}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-rose-600 outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              <span>Delete</span>
            </DropdownMenu.Item>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
