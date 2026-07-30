My Life Planner V19 — Lists Runtime Fix

Changes in V19:
- Fixed a JavaScript runtime error caused by renderCleaningToday trying to update a removed cleaningTodayArea element.
- This error had stopped renderAll before the Lists renderers and button refreshes ran.
- Added a safe guard so the obsolete renderer exits when its old element is absent.
- Version references synchronised to V19.
- No saved-data structure changed.
