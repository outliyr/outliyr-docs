# Applying Cosmetics to Pawns

The `ULyraPawnComponent_CharacterParts` component resides on the Pawn actor (e.g., `ALyraCharacter`) and acts as the **runtime executor** for the cosmetic system. It takes the authoritative list of desired character parts and translates it into visible, attached actors on all clients.

<img src=".gitbook/assets/image (79).png" alt="" title="Lyra's Default Cosmetic Manager B_MannequinPawnCosmetics">

### Role

The `ULyraPawnComponent_CharacterParts` is responsible for:

* Managing the synchronized list of currently active cosmetic parts on this specific Pawn instance.
* Spawning and destroying the actual cosmetic Actors (`UChildActorComponent` based) based on the synchronized list.
* Attaching these spawned Actors correctly to the Pawn's skeleton or root.
* Applying cosmetic-driven changes to the base Pawn, such as swapping the Skeletal Mesh based on applied part tags.
* Broadcasting changes so other systems (like Animation Blueprints or material controllers) can react.

<img src=".gitbook/assets/image (81).png" alt="" width="375" title="B_MannequinPawnCosmetics on the B_Shooter_Mannequin">

### Core Responsibilities

1. **Receiving Part Requests (Authority):**
   * Provides functions like `AddCharacterPart`, `RemoveCharacterPart`, and `RemoveAllCharacterParts`.
   * These are marked `BlueprintAuthorityOnly` because the list of applied parts (`CharacterPartList`) is replicated from the server. Changes should only be initiated on the server (typically instructed by the `ULyraControllerComponent_CharacterParts`).
2. **Managing the Replicated List:**
   * Contains the `FLyraCharacterPartList CharacterPartList` member, which is marked Replicated.
   * `FLyraCharacterPartList` uses Unreal Engine's `FFastArraySerializer` for efficient network replication of the list of applied parts (`FLyraAppliedCharacterPartEntry`).
3. **Spawning/Destroying Actors (Client & Listen Server):**
   * Reacts to changes in the `CharacterPartList` pushed by the replication system.
   * Uses `SpawnActorForEntry` and `DestroyActorForEntry` internally to manage the lifecycle of the visual representation of each part.
   * **Note: `CharacterParts` are not spawned on the dedicated server**.
4. **Actor Attachment:**
   * `GetSceneComponentToAttachTo()`: Determines the appropriate parent component for attachments. It prioritizes the Pawn's `USkeletalMeshComponent` (if the owner is an `ACharacter`) and falls back to the Pawn's Root Component otherwise.
   * `SpawnActorForEntry` attaches the newly created `UChildActorComponent` to the determined parent component at the `SocketName` specified in the `FLyraCharacterPart`.
5. **Collision Handling:**
   * Applies the `ECharacterCustomizationCollisionMode` specified in the `FLyraCharacterPart` to the spawned Actor (either disabling collision or leaving it as defined in the part Actor).
6. **Tag Collection:**
   * `CollectCombinedTags()` (within `FLyraCharacterPartList`): Iterates through the currently spawned cosmetic actors and gathers any Gameplay Tags they possess (if they implement `IGameplayTagAssetInterface`).
   * `GetCombinedTags(FGameplayTag RequiredPrefix)`: Exposes the collected tags, allowing filtering by a prefix (e.g., getting only tags starting with `Cosmetic.BodyStyle`).
7. **Triggering Visual Updates:**
   * `BroadcastChanged()`: Called whenever parts are added, removed, or (potentially) changed. This function orchestrates updates based on the new set of applied parts.
     * It retrieves the combined cosmetic tags.
     * It uses the `FLyraAnimBodyStyleSelectionSet` BodyMeshes member to select the best `USkeletalMesh` (and potentially `UPhysicsAsset`) based on the tags.
     * It applies the selected mesh/physics asset to the parent Pawn's `USkeletalMeshComponent`.
     * It broadcasts the `OnCharacterPartsChanged` delegate.
8. **Delegate Broadcasting:**
   * `OnCharacterPartsChanged`: A multicast delegate fired by `BroadcastChanged` after parts have been spawned/destroyed and mesh changes applied. Other systems can bind to this to perform further cosmetic adjustments (e.g., applying material parameters based on team color, updating animation layers based on tags).

<img src=".gitbook/assets/image (78).png" alt="" title="B_Shooter_Mannequin listening for broadcasts from OnCharacterPartsChanged">

### Replication Deep Dive: `FLyraCharacterPartList`

The efficiency and correctness of the cosmetic system across the network rely heavily on `FLyraCharacterPartList` and its use of `FFastArraySerializer`.

* **Entries:** The `TArray<FLyraAppliedCharacterPartEntry>` holding the actual data for each applied part.
* **`FFastArraySerializer`:** This base struct provides the framework for replicating arrays efficiently. Instead of sending the whole array every time, it calculates deltas (adds, removes, changes) and replicates only those changes.
* **Serialization:** `NetDeltaSerialize` handles the low-level network serialization, delegating to the `FFastArraySerializer::FastArrayDeltaSerialize` template function.
* **Callbacks:** The key functions are the `FFastArraySerializer` contract callbacks, implemented in `FLyraCharacterPartList:`
  * **`PreReplicatedRemove`:** Called on clients before an item is removed locally from the Entries array due to replication. This is the correct place to call `DestroyActorForEntry` to clean up the spawned component before the array entry referencing it disappears.
  * **`PostReplicatedAdd`:** Called on clients after a new item has been added locally to the Entries array due to replication. This is where `SpawnActorForEntry` is called to create the visual representation for the newly added part.
  * **`PostReplicatedChange`:** Called on clients when an existing item has changed. The current implementation simply destroys the old actor and spawns a new one, as propagating fine-grained changes wasn't implemented.
* **Owner Component:** The list stores a pointer back to the owning `ULyraPawnComponent_CharacterParts` to access necessary functions like `GetSceneComponentToAttachTo` and trigger `BroadcastChanged`.
* **Marking Dirty:** When the server adds (`AddEntry`) or removes (`RemoveEntry`, `ClearAllEntries`) entries, it calls `MarkItemDirty` or `MarkArrayDirty` to notify the replication system that this list needs to be checked for changes during the next network update.

### Spawning & Destroying Logic

* **`SpawnActorForEntry`(`FLyraAppliedCharacterPartEntry& Entry`):**
  * Checks it's not on a dedicated server (no need for visuals).
  * Checks if the `PartClass` is valid.
  * Finds the correct `SceneComponentToAttachTo`.
  * Creates a `UChildActorComponent` dynamically using `NewObject`. **Note:** Using `UChildActorComponent` is a common way to attach and manage distinct Actors as components of another Actor.
  * Sets the `ChildActorClass` to `Entry.Part.PartClass`.
  * Attaches the `ChildActorComponent` to the parent scene component at the specified `SocketName`.
  * Registers the component, which causes the actual child Actor to be spawned.
  * Applies collision settings to the spawned child Actor.
  * Sets up a tick prerequisite to ensure the spawned part ticks after its attachment parent (potentially important for animation dependencies).
  * Stores the `UChildActorComponent` pointer in `Entry.SpawnedComponent`.
* **`DestroyActorForEntry`(`FLyraAppliedCharacterPartEntry& Entry`):**
  * Checks if `Entry.SpawnedComponent` is valid.
  * Calls `DestroyComponent()` on the `UChildActorComponent`. This automatically handles the destruction of the child Actor itself.
  * Clears the `Entry.SpawnedComponent` pointer.

### **Dedicated Server Behavior**

Cosmetic parts are **not spawned on dedicated servers**. This is handled explicitly inside `FLyraCharacterPartList::SpawnActorForEntry`, which includes a check to skip spawning cosmetic part actors on dedicated servers.

This has several important implications:

* **Performance Optimization:** No CPU or memory is spent managing cosmetic-only actors on a server nobody visually observes.
* **Listen Server Exception:** If the server is also running a local player (i.e., it’s a _Listen Server_), cosmetics **are** spawned for that local player only.
* **Empty Arrays on Server:** If you call `GetCharacterPartActors()` on a dedicated server, it will return an **empty array**, even if parts are technically “applied” in the replicated list. This is not a bug — it’s because no part actors exist on the server.

> [!success]
> **Be cautious** when writing logic that **iterates over cosmetic part actors**, always account for the possibility that no actors are spawned if running in a server-only context.

### Visual Updates & Animation Integration

* **`BroadcastChanged()`:** This is the central function linking applied parts to visual changes on the base Pawn.
  1. **Get Tags:** Calls `GetCombinedTags` to aggregate tags from all currently spawned parts.
  2. **Select Body Style:** Uses the `FLyraAnimBodyStyleSelectionSet` BodyMeshes member (editable on the component) and calls its `SelectBestBodyStyle` function, passing in the combined tags. This function iterates through `MeshRules`, checking tag requirements (`HasAll`) to find the best matching `USkeletalMesh`.
  3. **Apply Mesh:** If a valid `USkeletalMesh` is selected (and potentially different from the current one), it calls `SetSkeletalMesh` on the Pawn's `USkeletalMeshComponent`.
  4. **Apply Physics Asset:** If `BodyMeshes.ForcedPhysicsAsset` is set, it applies it using `SetPhysicsAsset`.
  5. **Notify Observers:** Fires the `OnCharacterPartsChanged` delegate.
* **`OnCharacterPartsChanged` Delegate:** This is the primary hook for custom logic reacting to cosmetic changes. Use cases include:
  * **Material Parameters:** Applying team colors or other dynamic material effects to the base mesh or cosmetic parts.
  * **Animation Blueprints:** Updating parameters or triggering logic in the `AnimBP` based on the new set of parts (e.g., enabling/disabling Animation Layers via `ULyraAnimLayerSelectionSet` - see the next documentation page for details on the selection logic).

### Summary

The `ULyraPawnComponent_CharacterParts` is the workhorse on the Pawn, managing the replicated state of cosmetics and translating that state into spawned actors and visual updates. It leverages efficient replication via `FFastArraySerializer` and provides hooks (`BroadcastChanged`, `OnCharacterPartsChanged`) for integrating cosmetic changes deeply with the Pawn's visuals and animation system.
