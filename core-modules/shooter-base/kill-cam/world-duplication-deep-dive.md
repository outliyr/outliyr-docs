# World Duplication Deep Dive

The Kill Cam system's ability to show a replay without interfering with the live game depends entirely on a specific, experimental Unreal Engine feature: **in-memory world duplication**. This page explains how it works, why it's necessary, and what implications it has for your project.

### Why Duplication is Necessary

Before understanding the solution, consider the problems with playing a replay directly in the live game world.

#### The In-Place Replay Problem

| Issue                | What Would Happen                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Actor Conflicts**  | The killer's pawn at position A (live) and position B (7 seconds ago in replay) would both exist simultaneously |
| **Physics Chaos**    | Replay projectiles could collide with live players; replay explosions could trigger live damage                 |
| **State Corruption** | Replay events like "pickup weapon" could affect live game inventory                                             |
| **Network Desync**   | Live game replication would conflict with replay replication                                                    |
| **Visual Noise**     | Two copies of every character, both moving independently                                                        |

#### The Duplication Solution

Instead of trying to manage these conflicts, the Kill Cam creates a completely separate sandbox:

```
┌─────────────────────────────────────────────────────────────────┐
│                         UWorld                                   │
│                                                                  │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │   DynamicSourceLevels      │  │  DynamicDuplicatedLevels   │ │
│  │   (Live Game)              │  │  (Kill Cam Sandbox)        │ │
│  │                            │  │                            │ │
│  │  • Real game simulation    │  │  • Replay playback only    │ │
│  │  • Network replication     │  │  • No network traffic      │ │
│  │  • Player input processed  │  │  • No player input         │ │
│  │  • Visible normally        │  │  • Visible during KC only  │ │
│  │                            │  │                            │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                  │
│  Only ONE collection is visible at any time - complete isolation │
└─────────────────────────────────────────────────────────────────┘
```

Key insight: The worlds never visibly coexist. When kill cam plays, the live world becomes invisible (but continues simulating in the background). This provides complete isolation between the two worlds.

### The Engine Hook

### `Experimental_ShouldPreDuplicateMap`

World duplication is enabled through a virtual function on the `UGameEngine` class:

```cpp
// In LyraGameEngine.h
UCLASS()
class ULyraGameEngine : public UGameEngine
{
    GENERATED_BODY()

protected:
    virtual bool Experimental_ShouldPreDuplicateMap(const FName MapName) const override;
};

// In LyraGameEngine.cpp
bool ULyraGameEngine::Experimental_ShouldPreDuplicateMap(const FName MapName) const
{
    // Enable duplication for all maps
    // You could add custom logic here based on MapName if needed
    return true;
}
```

When this function returns `true`, the engine performs the pre-duplication behavior:

{% stepper %}
{% step %}
#### Map duplication on load

The engine duplicates the map's dynamic levels at load time.
{% endstep %}

{% step %}
#### Duplicate level collection created

A second `FLevelCollection` is created with type `DynamicDuplicatedLevels`.
{% endstep %}

{% step %}
#### Duplicate collection starts hidden and inactive

This duplicate collection starts **hidden** and **inactive**.
{% endstep %}
{% endstepper %}

### Engine Configuration

For the custom engine class to be used, it must be specified in `Config/DefaultEngine.ini`:

```ini
[/Script/Engine.Engine]
GameEngineClass=/Script/LyraGame.LyraGameEngine
```

For **Unreal Engine 5.5 and later**, an additional CVar is required:

```ini
[ConsoleVariables]
s.World.CreateStaticLevelCollection=1
```

This CVar ensures the static level collection system is enabled, which is necessary for proper level collection management.

### Level Collections Explained

#### What is a Level Collection?

A `FLevelCollection` is the engine's way of grouping levels that should be processed together. Each UWorld can have multiple collections:

| Collection Type           | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `DynamicSourceLevels`     | The "real" game, all normal gameplay happens here          |
| `DynamicDuplicatedLevels` | The pre-created copy used for replay playback              |
| `StaticLevels`            | Levels that don't participate in gameplay (lighting, etc.) |

### Visibility Control

The Kill Cam system controls which collection is visible:

```cpp
// During kill cam start
FLevelCollection* DuplicateCollection = World->FindCollectionByType(
    ELevelCollectionType::DynamicDuplicatedLevels);
FLevelCollection* SourceCollection = World->FindCollectionByType(
    ELevelCollectionType::DynamicSourceLevels);

// Hide live game, show kill cam world
SourceCollection->SetIsVisible(false);
DuplicateCollection->SetIsVisible(true);
```

This visibility toggle provides complete isolation between the two worlds. Since only one world is ever visible, there's no possibility of visual or physics conflicts between them.

### Why This Works

When a collection is invisible:

* Its actors' components don't render
* Physics simulation continues but doesn't visually manifest
* The player can't see or interact with it

The live game keeps running in the background (invisible), so when kill cam ends, everything is exactly where it should be, no resynchronization needed.

### DemoNetDriver and World Assignment

#### The Playback Driver

When replay playback begins, a `UDemoNetDriver` is created to stream the recorded data. This driver needs to know which world to spawn actors in:

```cpp
// Assign the demo driver to the duplicate collection
FLevelCollection* DuplicateCollection = SourceWorld->FindCollectionByType(
    ELevelCollectionType::DynamicDuplicatedLevels);
DuplicateCollection->SetDemoNetDriver(PlaybackDemoNetDriver);
```

This ensures:

* Replay actors spawn in the duplicate world
* Replay replication doesn't interfere with live replication
* The replay's `UWorld` context is the duplicate collection

#### Level Prefix Override

When starting playback, a special option tells the replay system to reuse existing levels:

```cpp
TArray<FString> Options;
Options.Add(TEXT("LevelPrefixOverride=1"));
GameInstance->PlayReplay(ReplayName, nullptr, Options);
```

This prevents the replay system from trying to load new level instances, it uses the pre-duplicated ones instead.

### Adapting the Experience System

### The Problem

The `ULyraExperienceManagerComponent` exists on the GameState, which gets duplicated along with the world. Without special handling, the experience system would try to load and activate game features twice, once in each world.

### The Solution

The component checks which collection it's in before executing:

```plaintext
When experience load starts:
    Get the actor's level collection type

    If collection type is DynamicDuplicatedLevels:
        Skip the experience load (it's the duplicate world)
        Return early

    Otherwise:
        Proceed with normal experience loading
```

Similar checks exist in `EndPlay()` and `IsExperienceLoaded()` to ensure the duplicate world inherits the experience state without re-initializing it.

### Client-Side Nature

#### Why This Runs on Client

The entire Kill Cam process, recording, world management, and playback, happens on the **client that was killed**. The server is only involved for:

1. Authoritative death detection
2. Routing killer's data to victim
3. Timing coordination (start/stop messages)

The server never touches world duplication or replay playback.

#### Listen Server Limitation

This client-side architecture creates a critical limitation: **listen server hosts cannot use Kill Cam**.

Here's why:

```
Normal Client:
┌─────────────────────────────────────────┐
│ Client Process                          │
│ ┌─────────────────┐                     │
│ │ NetDriver       │ → Connection to     │
│ │ (Normal)        │   dedicated server  │
│ └─────────────────┘                     │
│                                         │
│ During Kill Cam:                        │
│ ┌─────────────────┐                     │
│ │ DemoNetDriver   │ → Replay playback   │
│ │ (Temporary)     │   (local only)      │
│ └─────────────────┘                     │
└─────────────────────────────────────────┘

Listen Server Host:
┌─────────────────────────────────────────┐
│ Host Process                            │
│ ┌─────────────────┐                     │
│ │ NetDriver       │ → ALL client        │
│ │ (Listen Server) │   connections!      │
│ └─────────────────┘                     │
│                                         │
│ If Kill Cam started:                    │
│ ┌─────────────────┐                     │
│ │ DemoNetDriver   │ → Would REPLACE     │
│ │ (Would break!)  │   server driver!    │
│ └─────────────────┘                     │
│                                         │
│ ⚠️ All clients would disconnect!        │
└─────────────────────────────────────────┘
```

The system detects listen server hosts and automatically disables Kill Cam for them.

### Checking Actor World Context

#### The Utility Function

Since actors can exist in either the source or duplicate world, the system provides a helper:

```cpp
// In UKillcamManager
UFUNCTION(BlueprintCallable)
static bool AreActorsFromSameLevel(AActor* FirstActor, AActor* SecondActor);

UFUNCTION(BlueprintCallable)
static bool IsInKillCamWorld(AActor* InActor);
```

#### How It Works

```plaintext
AreActorsFromSameLevel(FirstActor, SecondActor):
    Get level collection for FirstActor
    Get level collection for SecondActor

    If both collections are valid:
        Return true if collection types match

    Return false
```

#### When to Use

Use these functions when you need to prevent cross-world interactions:

* Targeting systems shouldn't target actors in the other world
* Interaction checks should verify same-world context
* Custom gameplay logic during kill cam

***

### Summary

The world duplication approach provides clean isolation between the live game and Kill Cam playback:

{% stepper %}
{% step %}
#### Engine enables duplication

A custom `UGameEngine` override enables pre-duplication.
{% endstep %}

{% step %}
#### Two level collections exist

A `DynamicSourceLevels` and `DynamicDuplicatedLevels` collection live in the same UWorld.
{% endstep %}

{% step %}
#### Visibility toggling provides isolation

Toggling visibility between collections ensures only one world is visible.
{% endstep %}

{% step %}
#### Complete isolation

Only one world is ever visible at a time, preventing conflicts.
{% endstep %}

{% step %}
#### Experience system adapted

The experience manager skips initialization in the duplicated world.
{% endstep %}

{% step %}
#### Client-side only

Duplication and playback occur on the victim client; the server only relays data.
{% endstep %}

{% step %}
#### Listen server excluded

Listen server hosts are detected and Kill Cam is disabled for them to avoid breaking networking.
{% endstep %}
{% endstepper %}

This foundation enables all the other Kill Cam systems to work without worrying about interference with the live game.
