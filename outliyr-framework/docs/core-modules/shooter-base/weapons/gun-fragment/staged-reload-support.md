# Staged Reload Support

The **Staged Reload System** allows weapons to track and resume reload progress based on gameplay animation events. This prevents exploits like animation canceling and enables more immersive reloading mechanics.

This system is entirely opt-in. If reload animations **do not** broadcast reload stage events, the reload system behaves like a traditional, non-interruptible reload.

***

### How It Works

* Reload abilities (e.g., GA\_Weapon\_Reload\_Magazine, GA\_Weapon\_Reload\_Shell) play a montage containing **reload stage gameplay events**
* Each event in the montage triggers a **`GameplayEvent.ReloadStage`**
* The event passes a tag which corresponds to a named reload section
* The **Gun Fragment** stores this section name in the `CurrentReloadSection` field of the weapon’s transient fragment
* If the reload is interrupted (e.g., by switching weapons), the weapon **remembers its progress**
* On next reload attempt, the weapon **resumes from the stored reload section**

***

### Requirements

* The reload montage must include **`GameplayEvent.ReloadStage`** events
* Each event must send a **tag** that maps to a section name (FName)
* The reload ability must have a **Tag-to-Section Map** configured (tag → FName)
* The weapon must use the **Gun Fragment**, which stores the current reload section

***

### Key Concepts

#### Gameplay Event Tag

```plaintext
GameplayEvent.ReloadStage
```

All staged reload montages should emit this gameplay event at key transition points.

***

#### FName Mapping

Each gameplay event includes a tag like `Reload.Stage.InsertMagazine`. The reload ability maintains a mapping:

```cpp
TMap<FGameplayTag, FName> ReloadStageToMontageSection;
```

This maps gameplay tags to montage section names, which are used to resume reloads.

***

#### Transient Fragment Field

```cpp
FName CurrentReloadSection;
```

When a `ReloadStage` gameplay event is received, the current reload section is updated and stored on the weapon instance. This is used to resume progress later.

***

### Interrupt & Resume

If a reload is interrupted (e.g., switching weapons), the weapon remembers where the reload was left off.

The **reload ability checks `CurrentReloadSection`** and begins from that section on the next activation. If no section is set, the reload starts from the beginning.

***

### Force Reload Ability

A separate passive ability, granted automatically while a weapon is held, ensures the player resumes reloading when necessary.

#### Behavior:

* Runs once on ability grant (when a weapon is equipped)
* Local-only
* Checks:
  * A weapon is equipped
  * Reload was previously interrupted
  * No reload is currently active
* If all checks pass, attempts to activate the weapon's reload ability

This ensures that players **cannot avoid completing a reload** simply by swapping weapons.

***

### Design Notes

* Staged reload behavior is **opt-in**
* Weapons who's reload montages have no `ReloadStage` events behave with traditional reload logic
* Developers are free to implement reload montages with as few or as many stages as needed
* The system does not dictate how many stages a reload has — it just listens for events

***

### Summary

The staged reload system adds depth and realism to weapon reload mechanics by:

* Tracking reload progress via gameplay events
* Allowing reloads to resume from interruption
* Preventing reload exploits via weapon swapping
* Maintaining flexibility for both simple and complex reload workflows

This system is fully modular, requires minimal setup, and can be ignored if not needed.
