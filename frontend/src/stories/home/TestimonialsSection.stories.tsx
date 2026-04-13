import React from 'react';
import TestimonialsSection from '../../components/home/TestimonialsSection';

const meta = {
  title: 'Home/TestimonialsSection',
  parameters: {
    layout: 'fullscreen',
    chromatic: {
      disableSnapshot: false,
      viewports: [320, 768, 1024, 1280],
    },
    docs: {
      description: {
        component: 'Testimonials section with desktop layout.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const Default = {
  render: () => <TestimonialsSection />,
};
