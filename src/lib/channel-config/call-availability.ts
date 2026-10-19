/**
 * Master switch for the Call channel while the voice gateway is being set up.
 *
 * When false: Settings → Channels → Call shows "coming soon", Call is hidden
 * from automation setup (Greeting Routes and the Send Messages drawer), and
 * automations neither queue nor show calls. Saved call settings, recordings
 * and rules are kept untouched, so flipping this back to true restores
 * everything as it was.
 */
export const CALL_CHANNEL_ENABLED = false;
