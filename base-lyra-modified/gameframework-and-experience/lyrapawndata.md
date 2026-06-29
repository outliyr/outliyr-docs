# Pawn Data

Every pawn in the framework is configured by a `ULyraPawnData` data asset. This single asset defines the pawn's class, abilities, input, camera, and HUD, everything needed to make a playable character. Other documentation pages reference individual pieces of PawnData in the context of their own systems; this page shows the complete picture and how all the pieces connect.

`ULyraPawnData` is a `UPrimaryDataAsset`, which means it is a non-mutable, Blueprint-accessible data asset that the asset manager can discover and load by ID. You create instances in the Content Browser and reference them from experience definitions and team configurations.

***

## What PawnData Contains

Each property on `ULyraPawnData` controls a different axis of pawn configuration:

* **PawnClass** — the actor class to spawn (`TSubclassOf<APawn>`). This is typically `ALyraCharacter` or a custom subclass. The GameMode reads this property when it needs to spawn a pawn for a player, routing through `GetDefaultPawnClassForController`. The class you specify here determines the physical pawn in the world — its mesh, its movement component, its collision.
* **AbilitySets** — an array of `ULyraAbilitySet` assets granted when the pawn initializes. Ability sets are the primary vehicle for giving a pawn its gameplay abilities, gameplay effects, and attribute sets in a single reusable package. A "base character" ability set might grant health attributes and a death ability. A "shooter" ability set might grant weapon abilities. Stacking multiple sets composes the pawn's full ability profile.
* **InputConfig** — a `ULyraInputConfig` asset that maps Input Actions to Gameplay Tags. This defines how player input routes to abilities and native action handlers. When the player presses a button mapped to an Input Action, the Input Config translates that into a Gameplay Tag, and the ability system activates the matching ability. The Hero Component reads this during initialization.
* **InputMappings** — an array of `FPawnInputMappingContextAndPriority` entries, each containing an `UInputMappingContext`, an integer priority, and a `bRegisterWithSettings` flag. These define the hardware-to-action bindings for this pawn type. Higher priority mappings win when multiple contexts map the same key. When `bRegisterWithSettings` is true, the mapping is registered with the Input Registry subsystem, making it available in key rebinding UI. The Hero Component adds these to the player's Enhanced Input subsystem during initialization.
* **DefaultCameraMode** — the camera mode class (`TSubclassOf<ULyraCameraMode>`) used when no ability is actively overriding the camera. The Hero Component reads this and sets it as the camera delegate on the pawn's camera component. Abilities can temporarily push different camera modes; when they end, the system falls back to this default.
* **TagRelationshipMapping** — a `ULyraAbilityTagRelationshipMapping` asset that defines ability tag relationships (block, cancel, require) for this pawn type. This lets you configure, per pawn archetype, which abilities can coexist and which abilities suppress others. The Pawn Extension Component applies this to the ASC during initialization.
* **Layout** — an array of `FPawnHUDLayoutRequest` entries, each pairing a `UCommonActivatableWidget` class with a UI layer tag. These define the structural HUD layouts for this pawn type.
* **Widgets** — an array of `FPawnHUDElementEntry` entries, each pairing a `UUserWidget` class with a slot tag. These are the individual HUD elements that slot into the layout's extension points.

<img src=".gitbook/assets/image (110).png" alt="" title="HeroData_ShooterBase PawnData">

### Where PawnData Comes From

PawnData reaches the pawn through two paths, and the GameMode arbitrates between them:

* **Experience DefaultPawnData** — the experience definition specifies a default `ULyraPawnData` for all players. This is the baseline. When the GameMode calls `GetPawnDataForController()` and no team-specific override exists, it returns this default. Most symmetric game modes (everyone plays the same character type) use only this path.
* **Per-team PawnData** — the `ULyraTeamCreationComponent` (which lives on the GameState and is injected by the experience) can override PawnData per team through its `TeamPawnData` map. This maps team IDs to PawnData assets. In asymmetric modes, hunters vs. prey, attackers vs. defenders, different teams get entirely different pawn configurations: different classes, different abilities, different input, different cameras. The `SetTeamPawnData()` function can update a team's PawnData at runtime, optionally re-applying the change to players already on that team.

### How PawnData Is Applied

<!-- gb-stepper:start -->
<!-- gb-step:start -->
#### GameMode resolves PawnData

`GetPawnDataForController()` checks whether the player's team has a specific PawnData override in the `ULyraTeamCreationComponent`. If it does, that override wins. Otherwise, the experience's `DefaultPawnData` is returned.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Pawn class is read and spawned

The GameMode's `GetDefaultPawnClassForController` reads `PawnData->PawnClass` and returns it to Unreal's spawning pipeline. `SpawnDefaultPawnAtTransform` creates the actor at the designated spawn point.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### PawnExtensionComponent stores the reference

The `ULyraPawnExtensionComponent` on the newly spawned pawn receives and stores the `ULyraPawnData` reference. This component acts as the central hub that other components read from during initialization.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Components read from PawnData during init

As the pawn's initialization state machine progresses, each component pulls its configuration from the stored PawnData:

* The **Hero Component** reads `InputConfig` and `InputMappings` to set up ability input bindings and Enhanced Input mapping contexts on the player's input subsystem.
* The **Hero Component** reads `DefaultCameraMode` and sets it as the camera delegate on the pawn's camera component.
* The **Pawn Extension Component** grants all `AbilitySets` to the pawn's Ability System Component, giving it the configured abilities, effects, and attribute sets.
* The **Pawn Extension Component** applies `TagRelationshipMapping` to the ASC, configuring which abilities block, cancel, or require each other.
<!-- gb-step:end -->

<!-- gb-step:start -->
#### Pawn is fully configured

All systems have read their configuration. The pawn has its abilities, its input responds to player actions, the camera is in the correct mode, and the HUD is configured. The pawn is ready for gameplay.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

### Creating a Custom PawnData

In the Content Browser, right-click and create a new Data Asset of type `ULyraPawnData`. Configure each field for your game mode's needs:

1. Set **PawnClass** to your character class (or `ALyraCharacter` if you have no custom subclass).
2. Add **AbilitySets** for the role's abilities. A typical setup might include a base character set (health, death, basic locomotion) and a role-specific set (weapons, special abilities).
3. Assign an **InputConfig** that maps the Input Actions your abilities need to the correct Gameplay Tags.
4. Add **InputMappings** for the hardware bindings your pawn requires, setting priorities to ensure game-mode-specific bindings override defaults when needed.
5. Choose a **DefaultCameraMode** appropriate for your game type (third-person, first-person, top-down).
6. Optionally assign a **TagRelationshipMapping** if your pawn type needs custom ability interaction rules.
7. Configure **Layout** and **Widgets** if this pawn type needs a specific HUD configuration beyond what the experience's game feature actions provide.

Reference the finished asset from your Experience Definition's `DefaultPawnData`, or from a team's `TeamPawnData` entry on the `ULyraTeamCreationComponent` for asymmetric modes.

<div style="text-align: center;">
  <video controls style="max-width: 100%; height: auto;">
    <source src=".gitbook/assets/create_pawn_data.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>
