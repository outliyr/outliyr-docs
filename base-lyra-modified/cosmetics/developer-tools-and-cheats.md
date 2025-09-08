# Developer Tools & Cheats

To facilitate testing, iteration, and debugging of character cosmetics, the system includes developer-focused settings and cheat commands. These allow developers to easily override or apply specific cosmetic parts without needing to modify gameplay logic or player loadouts.

### Developer Settings (`ULyraCosmeticDeveloperSettings`)

These settings provide a way to globally apply cosmetic overrides during development, primarily intended for use within the Unreal Editor and PIE sessions.

* **Location:** These are project-wide settings accessible via Edit > Project Settings > Game > Lyra Cosmetic Developer Settings (or similar, depending on exact project setup). The settings are stored in the project's `DefaultGame.ini` or a similar config file.
* **Class:** `ULyraCosmeticDeveloperSettings` (derives from `UDeveloperSettings`).

**Key Properties:**

* **`CheatMode` (`ECosmeticCheatMode`):** (Note: This enum wasn't explicitly in the provided code snippets but is typical for such settings) Controls how the cheat parts interact with normally applied parts. Common modes might be:
  * `AddParts`: Cheat parts are added alongside normally applied parts.
  * `ReplaceParts`: Cheat parts are added, and normally applied parts (`ECharacterPartSource::Natural`) are temporarily suppressed. (This mode seems implied by the `bSuppressNaturalParts` logic).
* **`CheatCosmeticCharacterParts` (`TArray<FLyraCharacterPart>`):** A list of character parts that will be automatically applied via this developer setting cheat. Configure this list with the desired PartClass, `SocketName`, and `CollisionMode` for each override part.

**How it Works:**

1. **Loading:** The settings are loaded when the editor or game starts.
2. **Application Trigger:** The `ULyraControllerComponent_CharacterParts::ApplyDeveloperSettings()` function is called automatically for each player controller during its `BeginPlay` sequence (on the server).
3. **Applying Parts:**
   * `ApplyDeveloperSettings` reads the `CheatCosmeticCharacterParts` list from the loaded developer settings.
   * It first potentially suppresses or unsuppresses any "Natural" parts already on the controller component based on the `CheatMode` and whether any cheat parts are defined.
   * It removes any parts previously added by this specific developer settings cheat (identified by `ECharacterPartSource::AppliedViaDeveloperSettingsCheat`) to ensure a clean re-application if the settings changed.
   * It then iterates through the `CheatCosmeticCharacterParts` list from the settings and calls `AddCharacterPartInternal` on the controller component for each, marking them with the source `AppliedViaDeveloperSettingsCheat`.
4. **Editor Integration (`WITH_EDITOR`):**
   * **`PostEditChangeProperty`, `PostReloadConfig`, `PostInitProperties`:** These editor-only functions call `ApplySettings`, which in turn calls `ReapplyLoadoutIfInPIE`.
   * **`ReapplyLoadoutIfInPIE`:** If currently running a `Play-In-Editor` session, this function finds the authority world and schedules `ApplyDeveloperSettings` to be called on all player controllers on the next tick. This allows developers to change the cosmetic settings in Project Settings and see the changes reflected live in their PIE session without restarting.
   * **`OnPlayInEditorStarted`:** Shows a brief notification toast message when PIE starts if any `CheatCosmeticCharacterParts` are defined, reminding the user that cosmetic overrides are active.

* **Use Case:** Ideal for quickly testing specific cosmetic combinations across all players in PIE, or for setting a default "developer appearance" without modifying actual game loadouts.

### Cheat Manager Extension (`ULyraCosmeticCheats`)

This provides console commands for adding, replacing, or clearing cosmetic parts on the local player during runtime.

* **Class:** `ULyraCosmeticCheats` (derives from `UCheatManagerExtension`).
* **Registration:** Automatically registers itself with the `UCheatManager` when the game starts.

**Console Commands (Authority Only):**

* **`AddCharacterPart <AssetName> [bSuppressNaturalParts]`**
  * **`<AssetName>`:** The short class name of the `AActo`r subclass representing the character part (e.g., `BP_Helmet_A`). The system uses `ULyraDevelopmentStatics::FindClassByShortName` to find the actual class.
  * **`[bSuppressNaturalParts]` (Optional, default: true):** If `true (or 1)`, any parts previously added via normal gameplay `(ECharacterPartSource::Natural)` will be temporarily suppressed while this cheat part is active. If `false (or 0)`, the cheat part is added alongside natural parts.
  * **Action:** Finds the local player controller's `ULyraControllerComponent_CharacterParts` and calls `AddCheatPart`, marking the source as `AppliedViaCheatManager`.
* **`ReplaceCharacterPart <AssetName> [bSuppressNaturalParts]`**
  * **Arguments:** Same as `AddCharacterPart`.
  * **Action:** First calls `ClearCharacterPartOverrides` (see below) to remove only parts previously added by cheats, then calls `AddCharacterPart` with the new asset name and suppression flag. Effectively replaces previous cheat parts with the new one(s).
* **`ClearCharacterPartOverrides`**
  * **Action:** Finds the local player controller's `ULyraControllerComponent_CharacterParts` and calls `ClearCheatParts`. This removes parts added via the cheat manager (`AppliedViaCheatManager`) and then reapplies any overrides specified in the `ULyraCosmeticDeveloperSettings`. It does not remove parts added via natural gameplay unless suppression was active, in which case it unsuppresses them.

**How it Works:**

1. The player opens the console (`~` key) and types one of the commands.
2. The `UCheatManager` routes the command to the `ULyraCosmeticCheats` extension.
3. The extension function executes (requires authority - typically works on listen servers or single player).
4. It retrieves the local player's controller.
5. It finds the `ULyraControllerComponent_CharacterParts` on that controller.
6. It calls the corresponding function on the controller component (`AddCheatPart` or `ClearCheatParts`), which then handles updating its internal list and applying the changes to the possessed Pawn.

* **Use Case:** Useful for quickly testing individual cosmetic parts or combinations directly in-game via the console without leaving the session or modifying project settings. Allows for rapid iteration on specific part visuals or attachment points.

### Summary

The developer tools and cheats provide essential workflows for cosmetic development:

* **Developer Settings:** Offer a way to apply persistent, project-wide cosmetic overrides for PIE sessions, ideal for baseline testing or setting developer defaults. Live-update in PIE enhances iteration speed.
* **Cheat Commands:** Allow targeted, runtime addition and removal of cosmetic parts via the console for quick in-game testing and debugging by individual developers.

These tools, combined with the core system's flexibility, enable efficient creation and testing of character cosmetic features.

