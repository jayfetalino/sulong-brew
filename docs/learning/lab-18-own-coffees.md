# LAB-18: adding your own coffees

## What was built

- In the roast form, the Coffee dropdown ends with **"+ Add a new coffee"**. It opens a small form (name, usual roast level, mainly for espresso). Saving it brings you back to your roast batch with the new coffee already chosen.
- **"Edit or delete this coffee"** appears once a coffee is chosen.
- Names cannot repeat (case and spacing ignored). A coffee that roast batches still use cannot be deleted, and the screen says how many use it.

## Key ideas

- **Put the action where the need is.** You find out a coffee is missing while logging a roast, so the way to add it is right there, not on a separate screen.
- **Do not lose what someone typed.** The coffee form replaces the batch form on screen, but the batch form's data stays in memory, so nothing typed is lost.
- **A deleted record is a marker, not a gap.** Coffees are hidden, not removed, so merging between devices still works. Old batches can still look up the name of a deleted coffee.
- **Refuse deletes that would orphan data.** Blocking the delete of a coffee in use is simpler and safer than cleaning up afterwards.
- **A bug the click-through caught:** right after saving a new coffee, the list the form looked in had not refreshed yet, so the usual roast level was not suggested and the batch could not be saved. The fix was to hand the form the coffee that was just saved instead of looking it up.

## Remember

When code reacts to something that was just saved, use the value you just saved, not a copy that may not have updated yet.
