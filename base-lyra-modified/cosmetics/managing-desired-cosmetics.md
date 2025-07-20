# Managing Desired Cosmetics

While the `ULyraPawnComponent_CharacterParts` handles the runtime application of cosmetics on the Pawn, the `ULyraControllerComponent_CharacterParts` is responsible for managing the persistent list of cosmetics that a specific Controller (representing a player or AI) wants to have applied.

<img src=".gitbook/assets/image (82).png" alt="" title="LyraControllerComponent_CharacterParts randomly selecting the cosmetics for the player">

> [!success]
> **Arena Gamemode Plugin** has character selection logic, which serves as a more complex example of how this system can be used.

### Role

This component lives on the `AController` (e.g., `ALyraPlayerController`) and acts as the **authoritative source and persistent store** for cosmetic choices associated with that controller. Its key functions are:

1. **Storing Desired Parts:** Maintains a list of `FLyraCharacterPart` entries that should be applied to any Pawn possessed by this Controller.
2. **Persistence Across Pawns:** Ensures that when the Controller possesses a new Pawn (e.g., after respawning), the stored cosmetic parts are automatically applied to the new Pawn's `ULyraPawnComponent_CharacterParts`.
3. **Handling Possession Changes:** Explicitly manages removing parts from the previously controlled Pawn and adding them to the newly controlled Pawn.
4. **Managing Different Sources:** Tracks why a part was added (e.g., natural gameplay loadout, developer cheat, settings override) to handle precedence and clearing correctly.
5. **Interface for Modification:** Provides authority-only functions to add or remove parts from its persistent list (e.g., called by loadout systems, inventory interactions, or cheat commands).

### Core Responsibilities

1. **Storing Desired Parts:**
   * Maintains a `TArray<FLyraControllerCharacterPartEntry>` CharacterParts.
   * `FLyraControllerCharacterPartEntry` stores the `FLyraCharacterPart` definition and the `ECharacterPartSource`. It also temporarily stores the `FLyraCharacterPartHandle` received from the Pawn component once the part is successfully applied.
2. **Applying Parts on Possession:**
   * In `BeginPlay`, it binds to the owning Controller's `OnPossessedPawnChanged` delegate.
   * **`OnPossessedPawnChanged(APawn* OldPawn, APawn* NewPawn)`:** This is the core logic for persistence:
     * It iterates through its stored `CharacterParts`.
     * For the `OldPawn` (if valid), it finds the `ULyraPawnComponent_CharacterParts` and calls `RemoveCharacterPart` using the stored Handle for each entry. It then resets the stored Handle.
     * For the `NewPawn` (if valid), it finds the `ULyraPawnComponent_CharacterParts`. For each entry in its list that doesn't currently have a valid Handle (meaning it needs applying) and isn't suppressed by a cheat (`Source != ECharacterPartSource::NaturalSuppressedViaCheat`), it calls `AddCharacterPart` on the new Pawn's component and stores the returned Handle.
3. **Modifying the Desired List (Authority Only):**
   * **`AddCharacterPart(const FLyraCharacterPart& NewPart)`:** Adds a part with `ECharacterPartSource::Natural`. This is the intended function for standard gameplay systems (loadouts, inventory) to call.
   * **`AddCharacterPartInternal(..., ECharacterPartSource Source)`:** The internal function that actually adds to the `CharacterParts` array and attempts to apply it immediately to the currently possessed Pawn (if any).
   * **`RemoveCharacterPart(const FLyraCharacterPart& PartToRemove)`:** Finds the matching part (using FLyraCharacterPart::AreEquivalentParts) in its list, removes it from the currently possessed Pawn using the stored handle, and then removes it from its internal `CharacterParts` array.
   * **`RemoveAllCharacterParts()`:** Clears parts from the current Pawn and empties the internal `CharacterParts` array.
4. **Handling Different Sources (`ECharacterPartSource`):**
   * **`Natural`:** Standard parts added via gameplay.
   * **`NaturalSuppressedViaCheat`:** A natural part that is temporarily deactivated because a cheat requires suppression.
   * **`AppliedViaDeveloperSettingsCheat`:** Parts added automatically based on ULyraCosmeticDeveloperSettings.
   * **`AppliedViaCheatManager`:** Parts added via console cheat commands (`ULyraCosmeticCheats`).
   * This source tracking allows cheats and developer settings to override or suppress natural parts and enables proper cleanup when cheats are removed.
5. **Interaction with Cheats and Settings:**
   * **`ApplyDeveloperSettings()`:** Called on `BeginPlay` (and potentially by editor changes) to read `ULyraCosmeticDeveloperSettings` and apply specified cheat parts, potentially suppressing natural parts based on the `CheatMode`.
   * **`AddCheatPart(...)`:** Called by `ULyraCosmeticCheats` to add a part via console command, potentially suppressing natural parts.
   * **`ClearCheatParts()`:** Called by `ULyraCosmeticCheats` to remove parts added specifically by the cheat manager and then reapply developer settings.
   * **`SetSuppressionOnNaturalParts(...)`:** Helper function to iterate through Natural parts and either remove them from the Pawn (setting source to `NaturalSuppressedViaCheat`) or re-add them (setting source back to Natural) based on cheat requests.

### Why It Matters

* **Persistence:** Without this component, cosmetic choices would be lost every time a player respawns. It ensures the player's desired appearance is maintained across Pawn lifetimes.
* **Centralized Authority:** It acts as the single point of truth on the server for what cosmetics should be applied to the Pawn controlled by this Controller.
* **Clean Separation:** It neatly separates the intent (desired parts stored here) from the execution (spawning/replication handled by the Pawn component).
* **Developer/Cheat Integration:** Provides hooks for easily overriding or testing cosmetics during development without modifying core gameplay loadout logic.

### Typical Interaction Flow

1. A game system (e.g., loadout manager, inventory UI) on the server determines the player needs a new cosmetic part.
2. This system gets the player's `AController`.
3. It finds the `ULyraControllerComponent_CharacterParts` on the Controller.
4. It calls `AddCharacterPart` (passing the `FLyraCharacterPart` definition) on the Controller component.
5. The Controller component adds the part to its internal list (`CharacterParts`) with Source = Natural.
6. It then immediately calls `AddCharacterPart` on the `ULyraPawnComponent_CharacterParts` of the currently possessed Pawn (if any), storing the returned handle.
7. The Pawn component handles replicating the change and spawning the part on clients (as described on the previous page).
8. If the player dies and respawns, the Controller possesses a new Pawn.
9. `OnPossessedPawnChanged` fires on the Controller component.
10. The Controller component iterates through its stored `CharacterParts`. Seeing entries without valid handles, it calls `AddCharacterPart` on the new Pawn's component for each, restoring the player's cosmetic appearance.

### Summary

The `ULyraControllerComponent_CharacterParts` is essential for managing the desired cosmetic state associated with a Controller. It ensures persistence across Pawn lifetimes and acts as the authoritative source instructing the Pawn component on what visuals to display, while also managing overrides from developer settings and cheats.

