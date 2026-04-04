# Developer Tools

Testing cosmetics during development requires quickly swapping parts without setting up a full loadout. The framework provides console commands and editor settings for this.

***

### Console Commands

These commands are defined in `ULyraCosmeticCheats` and run with authority only:

* **`AddCharacterPart <AssetName>`** — adds a cosmetic part by short class name. By default suppresses the character's natural parts so only the test part shows.
* **`ReplaceCharacterPart <AssetName>`** — clears all current cheat parts and adds the specified one. Also suppresses natural parts by default.
* **`ClearCharacterPartOverrides`** — removes all cheat parts and restores natural cosmetics.

***

### Developer Settings

In Project Settings under the Cosmetics category (`ULyraCosmeticDeveloperSettings`):

* An array of cosmetic parts (`CheatCosmeticCharacterParts`) that apply automatically in PIE.
* Two modes via `CheatMode`: **ReplaceParts** swaps all natural parts, **AddParts** layers on top of them.
* Changes apply live during PIE, no restart needed. Editing the settings triggers an immediate reapply.
* A toast notification appears when PIE starts if overrides are active, so you don't forget they're on.

***

### Source Tracking

The system tracks where each part came from via `ECharacterPartSource`: **Natural** (gameplay), **AppliedViaCheatManager** (console), or **AppliedViaDeveloperSettingsCheat** (editor settings). Natural parts can also be marked **NaturalSuppressedViaCheat** when cheats override them. When cheats are cleared, natural parts are restored to active. Developer settings reapply after cheat clearing.
