# ADR-018: Adding, editing and deleting your own coffees

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

The lab only knew the six coffees loaded on first run. A roast batch must point at a coffee, so a new bean could not be logged at all. Jay reported this while using the Roasts tab.

## Decision

- **Coffees are managed from the roast form, where the need appears.** The Coffee dropdown ends with "+ Add a new coffee". It opens a coffee form in place of the batch form. Everything typed for the batch is kept, and the new coffee is chosen when it is saved, with its usual roast level suggested as before. When a coffee is chosen, "Edit or delete this coffee" opens the same form. There is no separate coffees screen.
- **Same fields as the data model:** name, usual roast level, mainly for espresso. Origin and process are not separate fields; they stay part of the name, as in the seed coffees ("Peru Gesha dry process"). If Jay wants them as fields later, that is a data model change.
- **Names are unique** among coffees that are not deleted, ignoring case and extra spaces, so the dropdown never shows two coffees that look the same. A deleted coffee's name can be used again.
- **Delete is a soft delete** (`deletedAt`, ADR-006) like other records, so it merges to other devices. A coffee that roast batches still use cannot be deleted: the screen says how many batches use it. This keeps every batch, and every brew linked to it, showing a real coffee name. Deleted coffees are hidden from the picker but still used to name old records.
- **No backup changes.** Export and import already carry coffees with `deletedAt`, merged by id with the newest `updatedAt` winning. A test covers the form rules (`coffee.test.ts`) and the database rules (`db/coffees.test.ts`).

## Alternatives

- **A "Coffees" section or fourth tab:** more room for later, but one more place to learn, and the need appears while logging a roast.
- **Free-text coffee name on each batch:** simpler, but the same coffee would get different spellings, and the link between roasts, brews and recipes by coffee would break.
- **Allow deleting a coffee in use:** would leave batches and brews showing "Unknown coffee".

## Consequences

- If a coffee is deleted on one device while another device adds a batch for it, after merge that batch shows "Unknown coffee" until it is edited. Rare for one person; revisit if it happens.
- The seed coffees can be edited or deleted like any other. They are not re-created once deleted, because first-run seeding happens once.
