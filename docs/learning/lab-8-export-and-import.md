# LAB-8: JSON export and merge-import

## What was built

- A **Backup** screen, opened from the link at the top right of the app.
- **Export:** "Download backup file" saves `sulong-lab-backup-YYYY-MM-DD.json`. Where the device supports it, "Share backup file" opens the share sheet (AirDrop, Files).
- **Import:** choose a file and the app shows what would change ("Roast batches: 1 new, Brews: 1 new, Coffees: 6 unchanged"). Nothing is saved until you press Import.
- Bad files are refused with a reason, and nothing is changed.

## Key ideas

- **Merge by id, newest wins.** Each record has a permanent `id` and an `updatedAt`. If both devices have the record, the newer one is kept. Records only one device has are added. This is the code from LAB-2 (`mergeRecords`) put to work.
- **Deletions travel** because deleting only stamps the record (ADR-006), so the deletion is just another newer change.
- **Safe to repeat.** Importing the same file twice changes nothing the second time.
- **Never goes backwards.** An older backup can never overwrite something you edited more recently on this device.
- **All or nothing.** The writes happen in one transaction, and the file is fully checked before anything is touched.

## Remember

Each browser has its own data. To bring Mac and iPhone together: export on one, import on the other, then export from the second and import back on the first. Back up before big changes. The file contains all your private data, so do not share it or commit it.
