import React from 'react';
import SmartWorkflowSection from '../../components/home/SmartWorkflowSection';

const meta = {
  title: 'Home/SmartWorkflowSection',
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disableSnapshot: false,
      viewports: [320, 768, 1024, 1280],
    },
      description: {
        component: 'Smart workflow section with desktop and mobile layouts.',
      },
  },
  tags: ['autodocs']
};

export default meta;

export const Default = {
  render: () => <SmartWorkflowSection />,
};
