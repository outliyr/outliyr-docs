# Collision Management

A unique challenge presented by the killcam's world duplication technique is the potential for unwanted interactions, particularly physical collisions, between actors in the **live source world** and actors in the **visible duplicated world** during playback. Since both collections exist simultaneously in memory (even if only one is visible), physics and trace calculations could potentially "see" actors across these world boundaries.

The `UKillcamPlayback` system implements specific strategies to prevent these interactions and ensure actors within each world context only collide with others in the _same_ context.

### The Problem: Cross-World Collision

Imagine the killcam playback is active:

* The player's view shows the **duplicated world**. Actors here are moving according to the replay data (e.g., the killer running).
* The **source world** is hidden but still exists in memory. Actors here are continuing with the live game simulation (e.g., the player's _actual_ newly spawned pawn, other live players running around).

Without intervention, it's possible for:

* A projectile fired in the **duplicated world** (part of the replay) to hit an invisible actor from the **source world**.
* The player's invisible pawn in the **source world** to physically collide with a visible wall or actor from the **duplicated world**.
* Line traces performed by logic in one world to hit actors in the other.

These interactions would lead to incorrect simulation results, visual glitches, and unpredictable gameplay interference.

### Static Collision Solution: `IgnoreCollisionsBetweenCollections`

When the killcam playback begins and the view switches (`ShowKillcamToUser_Internal`), the system first addresses collisions between actors that _already exist_ in both collections.

1. **Collect Actors:** The function `CollectRelevantActorsWithComponents` is called for both the `DynamicSourceLevels` collection and the `DynamicDuplicatedLevels` collection.
   * It iterates through all actors in all levels within the specified collection.
   * For each actor, it calls `GetRelevantComponents` to find all attached `UPrimitiveComponent` instances that have collision enabled (`IsCollisionEnabled()`) and are not static (`Mobility != EComponentMobility::Static`). Static geometry generally doesn't pose the same dynamic interaction risks.
   * It stores these actors and their relevant components in `TMap`s (`SourceCollectionActors`, `DuplicateCollectionActors`).
2. **Apply Ignore Rules:** The core function `IgnoreCollisionsBetweenCollections` then iterates through the collected actors:
   * For every relevant component on every actor in the **source collection**, it iterates through every relevant component on every actor in the **duplicate collection**.
   * It calls `SourceComponent->IgnoreActorWhenMoving(DuplicateActor, true)` and `DuplicateComponent->IgnoreActorWhenMoving(SourceActor, true)`. This tells the physics system that these specific components should ignore each other for movement-based collision checks. _Note: While the function name implies "moving", this typically sets up broad collision filtering between the actors._

This initial pass ensures that all existing, relevant actors in the source world are set to ignore all existing, relevant actors in the duplicate world, and vice-versa, preventing unwanted collisions between them.

### Dynamic Actor Solution: Real-time Tracking

Actors can also be spawned _during_ killcam playback (either in the source world by live gameplay or in the duplicate world by the replay stream). These newly spawned actors also need collision handling applied.

1. **Start Tracking (`StartTrackingDynamicActors`):** When `ShowKillcamToUser_Internal` runs, it calls this function.
   * It registers a handler (`FOnActorSpawned::FDelegate::CreateUObject(this, &UKillcamPlayback::OnActorSpawned)`) with the `SourceWorld`'s `OnActorSpawned` delegate. This means `OnActorSpawned` will be called every time _any_ actor is spawned in _either_ the source or duplicate collection (since they share the same parent UWorld).
2. **`OnActorSpawned` Handler:**
   * Gets the newly spawned `NewActor`.
   * Determines which collection the `NewActor` belongs to (source or duplicate) by checking its `Level->GetCachedLevelCollection()`.
   * Calls `GetRelevantComponents` to find its relevant primitive components.
   * Calls `AddIgnoreRulesForDynamicActor`, passing the new actor/components tuple and the `TMap` containing actors from the _other_ collection (e.g., if the new actor is in the source, pass `DuplicateCollectionActors`; if it's in the duplicate, pass `SourceCollectionActors`).
   * Adds the new actor and its components to the appropriate tracking map (`SourceCollectionActors` or `DuplicateCollectionActors`).
3. **`AddIgnoreRulesForDynamicActor`:** This function iterates through the new actor's relevant components and applies `IgnoreActorWhenMoving` rules between them and _all_ relevant components of _all_ actors currently tracked in the opposing collection's map.
4. **Stop Tracking (`StopTrackingDynamicActors`):** When the killcam ends (`HideKillcamFromUser_Internal`), this function is called to unregister the `OnActorSpawned` handler, preventing further processing after playback stops. The tracking maps (`SourceCollectionActors`, `DuplicateCollectionActors`) are also cleared.

This dynamic tracking ensures that even actors created mid-playback are immediately configured to ignore actors in the opposing world context, maintaining collision isolation throughout the killcam duration.

### Utility: Checking Actor World Context (`AreActorsFromSameLevel`)

The `UKillcamManager` provides a static helper function:

```cpp
UFUNCTION(BlueprintCallable)
static UE_API bool AreActorsFromSameLevel(AActor* FirstActor, AActor* SecondActor);
```

This function compares the `Level->GetCachedLevelCollection()->GetType()` of two actors. It returns `true` if they belong to the same collection type (both source or both duplicate) and `false` otherwise.

This utility can be used in other parts of your game logic (e.g., Gameplay Abilities, interaction checks) if you need to explicitly prevent actions or interactions between an actor in the source world and an actor in the duplicate world during killcam playback. For instance, a targeting system running in the source world should probably use this check to ensure it doesn't target an actor that's only visible in the killcam's duplicate world.

By combining the initial bulk ignore setup with dynamic tracking of spawned actors, the system effectively isolates the physics and collision interactions of the source and duplicate worlds, enabling the killcam to play back within its own sandbox without disrupting the live game.

***
