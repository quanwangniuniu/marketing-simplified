import React from 'react';
import CtaSection from '../../components/home/CtaSection';

const meta = {
  title: 'Home/CtaSection',
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disableSnapshot: false,
      viewports: [320, 768, 1024, 1280],
    },
    docs: {
      description: {
        component: 'CTA section with desktop and mobile layouts.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const Default = {
  render: () => {
    const handleGetStartedClick = () => {};

    return <CtaSection onGetStartedClick={handleGetStartedClick} />;
  },
};
