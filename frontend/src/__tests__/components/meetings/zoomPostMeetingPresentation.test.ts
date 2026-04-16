import {
  recordingBadgeParts,
  recordingSecondaryLine,
  resolveTopBanner,
  summarySecondaryLine,
} from '@/components/meetings/zoomPostMeetingPresentation';
import type { ZoomPostMeeting } from '@/types/meeting';

function zpm(partial: Partial<ZoomPostMeeting>): ZoomPostMeeting {
  return {
    meeting_status: 'ended',
    start_time: null,
    end_time: null,
    duration_minutes: null,
    actual_participants_count: null,
    recording_status: 'unknown',
    summary_status: 'not_applicable',
    sync_state: 'ok',
    sync_error: '',
    last_sync_at: null,
    has_participant_breakdown: false,
    participant_breakdown_count: 0,
    has_transcript_asset: false,
    recording_file_count: 0,
    summary_text: '',
    participants: [],
    recording_files: [],
    user_feedback_code: null,
    ...partial,
  };
}

describe('zoomPostMeetingPresentation', () => {
  describe('resolveTopBanner', () => {
    it('sync_state partial shows partial retrieval copy, not summary-specific wording', () => {
      const banner = resolveTopBanner(
        zpm({
          sync_state: 'partial',
          user_feedback_code: null,
          summary_status: 'not_applicable',
        }),
        true,
      );
      expect(banner).not.toBeNull();
      expect(banner!.text).toContain('Basic Zoom meeting details are synced');
      expect(banner!.text).not.toMatch(/summary/i);
      expect(banner!.variant).toBe('neutral');
    });

    it('sync_state ok + summary_status not_applicable: no misleading global warning', () => {
      const banner = resolveTopBanner(
        zpm({
          sync_state: 'ok',
          summary_status: 'not_applicable',
          user_feedback_code: 'not_applicable',
        }),
        true,
      );
      expect(banner).toBeNull();
    });

    it('sync_state ok + user_feedback_code null: no banner', () => {
      expect(resolveTopBanner(zpm({ sync_state: 'ok', user_feedback_code: null }), true)).toBeNull();
    });
  });

  describe('recording module', () => {
    it('recording_status available with files: badge shows Available and secondary hidden', () => {
      const z = zpm({
        sync_state: 'ok',
        recording_status: 'available',
        recording_file_count: 1,
        recording_files: [
          {
            file_type: 'MP4',
            recording_type: 'shared_screen_with_speaker_view',
            play_url: 'https://zoom.example/play',
            download_url: 'https://zoom.example/dl',
          },
        ],
      });
      expect(recordingBadgeParts(z)).toMatch(/Available/);
      expect(recordingBadgeParts(z)).toContain('1 file');
      expect(recordingSecondaryLine(z)).toBeNull();
    });

    it('recording_status none + no files: neutral empty line, not error tone', () => {
      const z = zpm({
        sync_state: 'ok',
        recording_status: 'none',
        recording_file_count: 0,
        recording_files: [],
        summary_status: 'available',
        summary_text: 'x',
      });
      const line = recordingSecondaryLine(z);
      expect(line).toContain('no cloud recording');
      expect(line!.toLowerCase()).not.toMatch(/error|failed|http/);
    });
  });

  describe('summary module', () => {
    it('summary_status available + summary_text: no secondary unavailable line', () => {
      const z = zpm({
        sync_state: 'ok',
        summary_status: 'available',
        summary_text: 'The meeting reviewed campaign pacing.',
      });
      expect(summarySecondaryLine(z)).toBeNull();
    });

    it('summary_status available but empty text: secondary explains empty body', () => {
      const z = zpm({
        sync_state: 'ok',
        summary_status: 'available',
        summary_text: '   ',
      });
      expect(summarySecondaryLine(z)).toContain('No summary text');
    });
  });
});
