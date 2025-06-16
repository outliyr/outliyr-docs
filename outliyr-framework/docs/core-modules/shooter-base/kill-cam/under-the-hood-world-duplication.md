# Under the hood: World Duplication

The ability of the Shooter Base Killcam system to function hinges entirely on a specific, experimental feature within Unreal Engine: **in-memory world duplication**. This process creates a temporary, isolated copy of the game's current state where the killcam replay can be safely played back without interfering with the live, ongoing game.

### The Foundation: `ULyraGameEngine` & Experimental Duplication

To enable this core mechanism, the project utilizes a custom Game Engine class, `ULyraGameEngine`, which inherits from the standard `UGameEngine`. The key modification is overriding an experimental function:

```cpp
// In LyraGameEngine.h
UCLASS()
class ULyraGameEngine : public UGameEngine
{
    // ... other code ...
protected:
    virtual bool Experimental_ShouldPreDuplicateMap(const FName MapName) const override;
    // ... other code ...
};

// In LyraGameEngine.cpp
bool ULyraGameEngine::Experimental_ShouldPreDuplicateMap(const FName MapName) const
{
    // Right now enabled for all our levels, but you can make custom logic using the MapName
    return true;
}
```

* **`Experimental_ShouldPreDuplicateMap`:** When this function is overridden in your project's active `UGameEngine` class and returns `true`, it signals to the engine **during startup in Standalone mode** that it should create an in-memory duplicate of the loaded map's dynamic level content.
*   **Engine Configuration:** To make the engine use this custom class, it must be specified in your project's configuration file (`Config/DefaultEngine.ini`):

    ```ini
    [/Script/Engine.Engine]
    GameEngineClass=/Script/LyraGame.LyraGameEngine

    # if your unreal engine version is 5.5 or higher
    [ConsoleVariables]
    s.World.CreateStaticLevelCollection=1
    ```

**Crucially, this duplication only happens when the game is launched in Standalone mode.** The engine does not perform this duplication during Play-In-Editor (PIE) sessions. This is the fundamental reason the Killcam system is limited to Standalone Game mode.

### Why is Duplication Necessary?

Playing back a replay directly within the "live" game world presents significant problems:

* **State Conflicts:** Replay actors (representing past positions) would exist alongside live actors, leading to visual chaos and potential interaction issues.
* **Interference:** Actions in the replay (like spawning effects) could wrongly affect the live game state.
* **Synchronization:** Keeping the replay perfectly synchronized with a dynamic, ongoing live world is extremely complex and prone to errors.
* **Seamless Transition:** By simply switching the visibility between the `DynamicSourceLevels` and `DynamicDuplicatedLevels`, the system can transition the player's view into and out of the killcam without loading screens.

By creating a **complete, isolated duplicate** of the world state at a certain point (or using the continuously updated duplicate), the replay system can operate within a controlled sandbox. The `UDemoNetDriver` used for playback operates within this duplicate world, replaying actor movements and events without any risk of corrupting or interfering with the actual game simulation occurring in the primary world instance that the server and other clients are interacting with.

### Level Collections

Unreal Engine manages different world states using Level Collections. When world duplication is enabled via `Experimental_ShouldPreDuplicateMap`, the engine creates a new collection identified internally by the type `ELevelCollectionType::DynamicDuplicatedLevels`.

The `UKillcamPlayback` system specifically targets this duplicated level collection when it needs to start playback. It makes this collection visible to the local player while hiding the original (`ELevelCollectionType::DynamicSourceLevels`) collection. Code often needs to check the collection type of an Actor's Level (`Actor->GetLevel()->GetCachedLevelCollection()->GetType()`) to determine if it resides in the source world or the duplicated killcam world.

When duplication is active, the client's `UWorld` manages two primary dynamic level collections:

* **`ELevelCollectionType::DynamicSourceLevels`:** This collection represents the "live" world. It's where the player controller resides, gameplay simulation occurs, and interactions normally happen. This collection is initially visible.
* **`ELevelCollectionType::DynamicDuplicatedLevels`:** This collection holds the parallel, duplicated set of levels. It's initially hidden and inactive. The Killcam system hijacks this collection to stage and run the replay playback using the DemoNetDriver.

### **Client-Side Nature & Listen Server Limitation**

It's vital to remember that the core Killcam process—recording, world state management (duplication and visibility), replay playback, and view control—occurs entirely on the client of the player who was eliminated. This client-centric design has an important implication: **the feature is not supported for a player hosting a listen server.**

When a client enters the killcam, its connection to the live game is temporarily replaced by a replay connection (`DemoNetDriver`). If a listen server were to do this, it would terminate its NetDriver that manages all connected clients, causing a server-wide desync. Therefore, the killcam is automatically disabled for the host to preserve game integrity.

In a typical game session (either on a dedicated server or for clients connected to a listen server), the server's role is limited to sending authoritative messages to the specific client that was killed, telling it when to start and stop the killcam sequence and providing the necessary context (like the killer's PlayerState).

### Adapting the Experience System (`ULyraExperienceManagerComponent`)

The Lyra Experience system, managed by `ULyraExperienceManagerComponent` on the `GameState`, is designed to load and activate game features and actions when an experience starts. Since the `GameState` exists in both the source world and its duplicate, a check was added to prevent the experience system from running its full initialization logic twice:

```cpp
// Inside ULyraExperienceManagerComponent::StartExperienceLoad()
ULevel* const ActorLevel = GetOwner()->GetLevel();
const FLevelCollection* const ActorLevelCollection = ActorLevel ? ActorLevel->GetCachedLevelCollection() : nullptr;
if(ActorLevelCollection && ActorLevelCollection->GetType() == ELevelCollectionType::DynamicDuplicatedLevels)
{
    UE_LOG(LogLyraExperience, Log, TEXT("EXPERIENCE: Skipping experience load for duplicated and visible collection"));
    return; // Don't load/activate features again in the duplicate world
}

// Inside ULyraExperienceManagerComponent::EndPlay() - similar check to skip deactivation

// Inside ULyraExperienceManagerComponent::IsExperienceLoaded() - returns true immediately if in duplicate world
if(ActorLevelCollection && ActorLevelCollection->GetType() == ELevelCollectionType::DynamicDuplicatedLevels)
{
    return true;
}
```

This ensures that game features, components, and actions specified by the Lyra Experience are only added and activated once in the primary world context, preventing redundant operations and potential conflicts in the duplicated killcam world. The duplicated world essentially inherits the state established by the experience in the source world at the time of duplication or update.

### Limitations Recap

The reliance on `Experimental_ShouldPreDuplicateMap` directly enforces the **Standalone Mode Only** limitation of the Killcam system. Understanding this duplication mechanism is key to grasping why the system works the way it does and why it cannot function within the editor environment. Any troubleshooting or modification must account for the existence of these two distinct but related world collections during killcam playback.

***
