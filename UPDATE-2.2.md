# Recall 2.2.0 — optional search refinement

Searches stay independent by default. After entering a query, click **Refine** beside the search box to open **Add details to this search**. Extra clues are combined with the original query and sent through the same local semantic search model. Results update as you type; Enter searches immediately and Shift+Enter inserts a newline in the details field.

Example: start with “the video explaining a trap,” then add “Minecraft, using redstone to move the floor.” You can edit the details without changing your original inquiry. Date filters apply to the combined search.

Changing or clearing the main query closes refinement and clears extra clues. Closing Refine returns to the original query. Reopening the popup restores only the main query and date filter; refinement is off. There is no accumulated conversation history between searches.

No new dependency, permission, model or remote service was added. Reload Recall after updating, then reopen its popup. No runtime rebuild is needed for this change if vendor/ is already present.

All 37 Node tests and the new optional browser regression pass. Browser checks cover query composition, independent searches, keyboard controls, filters, clearing, reopening and delayed responses. The real local model/ranker found saved transcript fixtures at 1:12 and 0:42. Live YouTube caption capture was unchanged; no new live caption test was run.
