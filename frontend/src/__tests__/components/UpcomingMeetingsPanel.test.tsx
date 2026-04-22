import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import UpcomingMeetingsPanel from '@/components/dashboard/UpcomingMeetingsPanel';

describe('UpcomingMeetingsPanel', () => {
  test('does not render the empty-state copy while loading', () => {
    render(<UpcomingMeetingsPanel meetings={[]} isOpen loading />);

    expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();
    expect(screen.queryByText('No upcoming meetings.')).not.toBeInTheDocument();
  });
});
