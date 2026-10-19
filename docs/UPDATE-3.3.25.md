# CueWoven v3.3.25

**Image storage** under Your data now offers 120 MB, 240 MB (default), 500 MB or 1 GB for scenes and article images. The image count limit scales with the size: 240 MB keeps the previous 20,000-image limit and 1 GB allows about 85,000. Lowering the size asks for confirmation, then removes the oldest images that no longer fit. Raising it never removes anything. Reset settings to default keeps the chosen size, as it keeps the Forget setting.

Images still follow **Forget what I watch or read after**. If the image storage size is reached first, the oldest images are removed early and Your data now says so, suggesting a shorter Forget time or Lite mode. The message clears after items are forgotten or deleted. When the chosen size is not yet known to the engine, images are never removed early; the next prune applies the size.

Backups restore up to the largest size's image count, then keep what fits the chosen size. Snapshot capture rules are unchanged: a simulation of the existing rules showed that limiting captioned videos to one snapshot per minute would leave only about 19% of distinct moments in a typical vlog findable, against about 87% today, so capture rates were kept.

Larger sizes load more image search data per visual search. In-memory ranking of synthetic 512-dimension vectors measured 8 ms at 20,000 images (about 39 MB of vectors) and 37 ms at about 85,000 images (about 167 MB). These figures exclude reading vectors from IndexedDB and the text model, and were measured in Node, not Chrome.

Validation: all 282 Node tests pass, including image storage size limits, trimming to a smaller size, keeping extra images at 1 GB, full-storage reporting, reset preserving the size, and restoring beyond the old 20,000-image limit. The new storage tests fail without the change. Browser checks of the new control and IndexedDB timing at 1 GB were not run for this release. No permissions, dependencies or storage format changed.
