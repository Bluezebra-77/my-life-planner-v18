# My Life Planner v52c Corrected — Daily Companion, Part 1

## Added
- A time-aware Daily Companion brief on Home.
- Morning, afternoon and evening greeting and supportive wording.
- At-a-glance counts for appointments, Today’s Focus, dated items and Planner Health suggestions.
- Optional estimated workload using focus estimates and timed appointments.
- Compact cards for Planner Health, latest backup, Brain Inbox, Waiting For follow-ups and recurring responsibilities due.
- Each dashboard card opens the relevant area.

## Preserved
- All v52b Planner Health, repeated-task suggestions, Help & Guides, data storage, recurrence, timer and Calm Interface behaviour.

## Corrected after testing
- Restored v52b repeated-task history by migrating the earlier `myLifePlannerHabitHistory` store into the current pattern store.
- Planner Health refreshes immediately when a repeated Today’s Focus entry reaches the suggestion threshold.
- On iPhone, Daily Companion now opens as a compact “at a glance” strip with a More/Less control; desktop retains the full layout.

## Corrected package verification
- Uses a new service-worker cache identity so iPhone cannot keep serving the earlier v52c layout.
- Uses a fresh phone-companion preference key, so the iPhone view defaults to the compact strip.
- The extracted folder name explicitly includes `Corrected`.
