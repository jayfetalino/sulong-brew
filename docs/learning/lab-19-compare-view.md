# LAB-19: comparing brews side by side

## What was built

- On the **Brews** tab, a **Compare** button. Tap it, tick 2 or 3 brews, tap **Compare (n of 3)**.
- A screen with one column per brew. Rows are grouped as Brew, How it was made, In the cup, and Notes. Rows where the brews are not all the same are marked **differs**, and a switch hides the rows that match.
- Demo readings keep their "(demo)" mark. Missing values say "Not set".

## Key ideas

- **Show the difference, do not judge it.** The view cannot know which brew is better, because you have not set any targets. It points at what changed and leaves the tasting to you.
- **Compare the real numbers, not the text.** Two weight losses can both display as 15.0 % and still differ. The check looks at the stored values, and the screen shows the rounded text.
- **Keep the logic out of the screen.** One plain function builds the rows, and another keeps the three-brew limit. Both have tests, so the screens only draw what comes back. This is the same pattern as the refractometer and scale code.
- **Make the data first, then test the screen.** The click-through writes records straight into the browser's database, reloads, and then drives the real page. The data setup is not what is being tested, so it can be quick.
- **Fixed bars cover content.** The compare bar sits above the tab bar, so the list needs extra space at the bottom, or the last card cannot be reached.

## Remember

When you change one roast and nothing else, the Brew group shows "differs" only on the roast rows, and the In the cup group shows what that change did. That is the comparison this app was built for.
