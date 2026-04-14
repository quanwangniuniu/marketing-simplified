import type { ReactNode } from 'react';

export default function TasksLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal} 
    </>
  );
}
