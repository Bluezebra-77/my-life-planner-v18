# Known Issues and Design Reviews

No release-blocking defects are known at packaging time.

## Review items

- **Progress bar:** retained for now, but its motivational and informational value remains under review.
- **Home versus Timeline:** continue observing whether the two views remain distinct and useful.
- **iOS background timer:** when iOS fully suspends a web app, an exact audible alert cannot be guaranteed. The planner stores the target finish time and recalculates when reopened.
- **Voice capture:** availability and behaviour depend on browser/device speech-recognition support.
- **Browser-local data:** information is stored on the current browser/device unless exported. Use Backup and Restore regularly.
