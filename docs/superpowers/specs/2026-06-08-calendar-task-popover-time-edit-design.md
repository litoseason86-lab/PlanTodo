# Calendar Task Popover Time Edit Design

## Context

The week calendar already supports quick creation from time grid selection, drag scheduling from the scheduling sidebar, timed task movement, and timed task resizing. The current quick-create popover only accepts title and category; the selected time is fixed by the initial click or drag. Existing timed task blocks can be moved or resized, but clicking a task does not expose a focused edit/delete surface.

This change adds two narrow behaviors:

- quick-create time refinement before creating a timed task
- click-to-edit/delete for existing timed tasks

The calendar remains responsible for scheduling and basic task metadata only. Task execution status such as done or postponed is out of scope for this calendar popover.

## Goals

- Allow manual start/end time refinement when creating a timed task from the week timeline.
- Constrain refined creation time to the original visual selection range.
- Open a floating editor when clicking an existing timed task.
- Allow editing title, category, start time, and end time from the floating editor.
- Allow deleting the task from the floating editor with confirmation.
- Preserve existing drag-to-schedule, drag-to-move, and resize behavior.

## Non-Goals

- No status controls in the calendar popover. Done/postponed state remains outside this surface.
- No all-day task edit popover in this change.
- No tag, priority, description, recurrence, or focus-session editing in this change.
- No backend schema or route changes. Frontend calendar API wrappers are allowed.
- No change to month or list view behavior.

## Time Range Rule

This spec uses the user-approved "range C" rule: the selected hour cell or dragged visual range defines the allowed manual-edit range.

- Single-click creation on an hour cell uses that hour as the allowed range. Example: clicking in the `01:00` row allows only `01:00-02:00`.
- Drag creation uses the dragged range as the allowed range. Example: dragging `01:30-03:00` allows only `01:30-03:00`.
- Single-click creation defaults to the clicked hour range, not to pointer minute plus 60 minutes. Example: clicking at `09:30` in the `09:00` row opens `09:00-10:00`, so the initial value is valid inside range C.
- The default timed task duration remains 60 minutes where it fits. For the final hour, the end is clamped to `23:59`; example: clicking the `23:00` row opens `23:00-23:59`.
- The minimum timed task duration remains 15 minutes.
- Manual input is invalid when `end <= start`.
- Manual input is invalid when duration is shorter than 15 minutes.
- Manual input is invalid when start or end falls outside the allowed range.

For existing timed task editing, the allowed range is the task's current `plannedDate` from `00:00` to `23:59`. Editing remains same-day only in this change. The editor must reject cross-day edits, `end <= start`, durations shorter than 15 minutes, and values outside `00:00-23:59`. Cross-day timed task editing via popover is out of scope because it would need a larger date-range editor.

## Proposed Architecture

### `weekTimelineInteraction.ts`

Extend the timed quick-create draft with explicit editable bounds:

- `editableStartAt`
- `editableEndAt`

The existing draft builders will calculate these bounds from the same source that creates default `startAt` and `endAt`.

For point creation, the editable range is the clicked hour cell and the default range is the full clicked hour, clamped to `23:59` for the last hour. For drag creation, the editable range is the normalized dragged range and the default range is the same normalized range.

Add pure helpers for time validation:

- convert local date-time strings to minute-of-day values
- validate a candidate range against editable bounds
- format range errors for the UI

These helpers stay pure and covered by controller tests.

### `CalendarQuickCreatePopover.tsx`

Add start/end time controls for timed drafts only. All-day drafts keep the current date-range display and do not show time fields.

The popover will:

- initialize local state from `draft.startAt` and `draft.endAt`
- validate time edits before submit
- show a clear range error such as `只能在 01:00-02:00 内调整`
- pass the refined `startAt` and `endAt` to submit

The submit contract changes from `{title, categoryId}` to include optional refined timed values:

- `{title, categoryId, startAt, endAt}` for timed drafts
- `{title, categoryId}` for all-day drafts

### `WeekTimelineView.tsx`

Timed task blocks gain a click handler that opens an edit popover anchored to the clicked task block.

The editor-open callback is passed through the existing component chain:

- `CalendarPanel`
- `CalendarSurface`
- `WeekTimelineView`

The implementation must not break:

- drag start for timed task movement
- resize handle pointer behavior
- quick-create pointer behavior on empty cells

Click handling must ignore the resize handle. Dragging a task must not also open the editor. Implement the guard with both a pointer movement threshold of more than 4px and a `dragStart` flag so a native draggable task does not emit a later click that opens the editor.

### `CalendarTaskPopover.tsx`

Create a focused popover for editing existing timed tasks.

Fields:

- title
- category
- start time
- end time

Actions:

- cancel
- save
- delete

The popover closes on outside pointer down and Escape. Delete uses an inline two-step confirmation: first click changes the destructive action to a confirmation state, and the second click calls the delete action. Cancel, outside pointer down, or Escape exits the confirmation state by closing the popover without deleting.

The popover does not include done/postponed controls.

### `useCalendarController.ts`

Track selected task editor state:

- selected task
- anchor position

Expose actions:

- open task editor
- close task editor
- submit task editor
- delete task from editor

After save or delete, refresh calendar data and call `onMutationSuccess` using the same mutation-success pattern as existing scheduling actions.

Task editor save is not atomic because the existing API separates details and schedule updates. The controller must:

- call only the mutations needed by the changed fields
- update schedule before details when both changed
- preserve the task's existing `priority` and `tagIds` when calling `updateTaskDetails`
- refresh calendar data after any save failure so the UI reflects the actual persisted state
- keep the editor open and show an error when a save fails
- close the editor only after all required save mutations succeed

### API Layer

Reuse existing task APIs through thin calendar wrappers:

- `tasksApi.updateTaskDetails` for title and category
- `tasksApi.updateTaskSchedule` for start and end time
- `tasksApi.deleteTask` for deletion

Add wrappers in `calendarApi.ts` only. Do not change backend contracts. The `updateTaskDetails` wrapper must receive or derive the current task's `priority` and `tagIds` and pass them through unchanged.

## Data Flow

### Quick Create

1. User clicks or drags a week timeline cell.
2. `WeekTimelineView` builds a timed quick-create draft with default time and editable bounds.
3. `CalendarQuickCreatePopover` renders title/category/start/end fields.
4. User edits time within the allowed range.
5. Popover validates the range.
6. `useCalendarController.submitQuickCreateDraft` creates the task with refined time.
7. Calendar data refreshes.

### Existing Task Edit

1. User clicks a timed task block.
2. `WeekTimelineView` calls `onOpenTaskEditor` with task and anchor.
3. `CalendarTaskPopover` renders current task fields.
4. User saves or deletes.
5. Controller validates same-day `00:00-23:59` time bounds and minimum 15-minute duration.
6. Controller persists the required mutation or mutations.
7. Calendar data refreshes.

## Error Handling

- Missing categories: keep existing quick-create behavior and disable category-dependent submit.
- Empty title: show `请输入任务标题`.
- Invalid time order: show `结束时间必须晚于开始时间`.
- Too-short time range: show `任务时长不能少于 15 分钟`.
- Out-of-range creation edit: show `只能在 HH:mm-HH:mm 内调整`.
- Out-of-range existing task edit: show `只能在 00:00-23:59 内调整`.
- Save API failure: show an inline popover error with the API error or `任务保存失败`. Failed save keeps the editor open.
- Delete API failure: show a toast with the API error or `任务删除失败`. Failed delete keeps the editor open.
- Refresh failure after mutation: show the existing refresh failure toast without undoing the mutation.

## Testing Plan

### Pure Controller Tests

- point quick-create draft exposes the clicked hour as editable bounds
- point quick-create draft defaults to the full clicked hour and stays valid when clicked at a non-zero minute
- final-hour point quick-create draft clamps to `23:59`
- drag quick-create draft exposes the dragged range as editable bounds
- time validation accepts ranges inside bounds
- time validation rejects ranges outside bounds
- time validation rejects `end <= start`
- time validation rejects duration shorter than 15 minutes

### Component Tests

- quick-create timed popover submits refined start/end time
- quick-create timed popover rejects out-of-range time
- all-day quick-create popover does not show time inputs
- clicking a timed task opens the edit popover
- dragging a timed task does not open the edit popover
- clicking the resize handle does not open the edit popover
- edit popover saves title/category/time
- edit popover requires confirmation before delete
- edit popover cancel/outside pointer down/Escape closes without deleting
- edit popover rejects cross-day, out-of-day, and shorter-than-15-minute ranges
- repeated save/delete clicks do not submit duplicate mutations while a request is in flight

### Controller/API Tests

- `calendarApi` exposes thin wrappers for updating task details and deleting tasks
- task editor save preserves existing `priority` and `tagIds` when updating title/category
- task editor save calls only schedule mutation when only time changes
- task editor save calls only details mutation when only title/category changes
- task editor save calls schedule then details when both change
- task editor save failure refreshes calendar data and keeps the editor open
- task editor delete success refreshes calendar data, triggers `onMutationSuccess`, and closes the editor
- task editor delete failure shows an error and keeps the editor open

### Integration/Regression Tests

- existing drag-to-schedule still works
- existing timed task movement still works
- existing timed task resize still works
- month and list views remain unaffected

## Acceptance Criteria

- A user can refine a newly selected timed task within the selected hour or dragged range before creating it.
- Single-click creation follows range C: the editable range is the clicked hour cell, and the initial range is valid inside that hour.
- A user cannot create a task with refined time outside the selected range.
- A user can click an existing timed task in week view and edit title, category, start time, and end time within the same `plannedDate` from `00:00` to `23:59`.
- Existing task edits preserve priority and tags.
- A user can delete an existing timed task from the edit popover after confirmation.
- The edit popover does not expose done or postponed status controls.
- Existing calendar drag, drop, and resize interactions continue to pass tests.
