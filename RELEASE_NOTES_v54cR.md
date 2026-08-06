# My Life Planner v54cR — iPhone Update Recovery

- Corrects an internal version mismatch that left `APP_VERSION` at `54b` inside the v54c application JavaScript.
- Uses a new service-worker script identity and cache name so installed iPhone PWAs can detect the update.
- Deletes only older `my-life-planner-*` caches; planner data in local storage is preserved.
- Uses network-first navigation with forced revalidation before falling back offline.
- Preserves all v54c recurring-limit, Home preview and Smart Projects changes.
