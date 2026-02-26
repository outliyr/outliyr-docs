# Integration

Enabling spectating in your game mode is straightforward, add a single Action Set to your Experience Definition. This page covers what the Action Set contains, dependencies to verify, and how to extend the system.

<img src=".gitbook/assets/image (220).png" alt="" title="Blueprint Spectator Logic in ShooterBase">

### One-Step Integration

{% stepper %}
{% step %}
#### Open Experience Definition

Open your `ULyraExperienceDefinition` asset (e.g., `B_Experience_TeamDeathmatch`).
{% endstep %}

{% step %}
#### Find Action Sets

Find the **Action Sets** array in the Details panel of the Experience Definition.
{% endstep %}

{% step %}
#### Add Action Set

Add `LAS_ShooterBase_Spectator` to the Action Sets array.
{% endstep %}

{% step %}
#### Save

Save the Experience Definition.\
That's it. The Action Set handles everything needed for post-death teammate spectating.
{% endstep %}
{% endstepper %}

> [!INFO]
> You can read [GameFramework & Exeprience](../../../base-lyra-modified/gameframework-and-experience/) section for a deep dive into how the experience system works.

### What the Action Set Contains

`LAS_ShooterBase_Spectator` includes three GameFeatureActions:

#### Add Components

```plaintext
GameFeatureAction_AddComponents:
    Target: APlayerState
    Component: USpectatorDataProxy
    Spawn: Client & Server
```

Adds the proxy to every player state so they can be spectated.

#### Add Abilities

```plaintext
GameFeatureAction_AddAbilities:
    Target: ALyraPlayerState

    Grants:
    - GA_Spectate (base spectating ability)
    - AbilitySet_Spectator:
        - GA_Spectate_Next (InputTag.Ability.Spectator.WatchNext)
        - GA_Spectate_Previous (InputTag.Ability.Spectator.WatchPrevious)
```

Grants the abilities needed to enter spectating and cycle targets.

#### Add Input Bindings

```plaintext
GameFeatureAction_AddInputBinding:
    Target: APawn (waits for ULyraHeroComponent readiness)
    Input Config: InputData_Spectator

    Mappings:
    - InputTag.Ability.Spectator.WatchNext → IA_Spectate_Next
    - InputTag.Ability.Spectator.WatchPrevious → IA_Spectate_Previous
```

Connects physical inputs to the cycling abilities.

***

### Input Setup

Ensure your Input Mapping Context includes bindings for:

* `IA_Spectate_Next` (e.g., Mouse Scroll Up)
* `IA_Spectate_Previous` (e.g., Mouse Scroll Down)

These should be active during spectating. The Action Set adds `IMC_Spectator` which typically provides these.

***

### Death Trigger

The Action Set grants `GA_Spectate`, but something must **activate** it when the player dies. The death ability in relevant game modes handles activing `GA_Spectate` after the player dies and deactivating it when the player respawns.

Check your experience's death handling to ensure `GA_Spectate` gets activated.

***

### Creating Custom Spectator UI

The default system broadcasts messages when spectated player state changes. Create your own widgets by:

#### Create a Spectator HUD Layout

Design widgets that show:

* Quickbar/weapon slots
* Active weapon indicator
* Ammo count
* "Spectating: \[PlayerName]" indicator
* ADS overlay (if applicable)

#### Listen for Messages

In each widget, register for the relevant message tags:

```plaintext
// Quickbar widget
Listen for: TAG_ShooterGame_Spectator_Message_SlotsChanged
Listen for: TAG_ShooterGame_Spectator_Message_ActiveIndexChanged

// Ammo widget
Listen for: TAG_ShooterGame_Spectator_Message_ActiveIndexChanged
(Then read SpareAmmo stat tag from the active weapon)

// ADS overlay
Listen for: TAG_ShooterGame_Spectator_Message_ToggleADS
```

#### Add Widgets via `GA_Spectate`

The `GA_Spectate` ability has a property to specify widgets to spawn when spectating starts. You can:

* Subclass `GA_Spectate` and add your widgets
* Or spawn widgets from a separate system listening for spectator possession

***

### Extending: Custom Spectating Logic

#### Different Target Selection

Override target selection by subclassing `GA_Spectate` and modifying:

* `PopulatePlayerTeam`, Which players can be watched
* `WatchNextPawn` / `WatchPreviousPawn`, How cycling works
* Initial target selection logic

#### Additional Replicated State

If you need to replicate more data to spectators:

1. Add properties to `USpectatorDataContainer` (or a subclass)
2. Create `OnRep_` functions that broadcast messages
3. Ensure the proxy replicates the new data

#### Different Input Bindings

Create new input actions and abilities that call `ATeammateSpectator::WatchNextPawn()` or `SetObservedPawn()`.
