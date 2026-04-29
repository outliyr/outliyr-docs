# Configuring Input

Three mechanisms configure input for a character, each serving a different scope:

* **PawnData** defines the default input setup for a pawn type.
* **Game Feature plugins** add or override input modularly, without touching the base pawn.
* **Ability Sets** link specific abilities to input tags at grant time.

Together they form a layered system: PawnData provides the foundation, Game Features extend it per-mode or per-plugin, and Ability Sets wire individual abilities to the keys the player presses.

***

## Pawn-Level Configuration

Every pawn's baseline input comes from its `ULyraPawnData` data asset, which carries two input-related properties:

<img src=".gitbook/assets/image (2) (1) (1).png" alt="" title="Pawn data asset showcasing the input section">

* **`InputConfig`** (`ULyraInputConfig*`) — maps Input Actions to Gameplay Tags. During initialization, `ULyraHeroComponent` reads this config and passes it to `ULyraInputComponent`, which binds both native actions (move, look) and ability actions (tag-routed).

<img src=".gitbook/assets/image (15).png" alt="" title="Input config asset">

* **`InputMappings`** (`TArray<FPawnInputMappingContextAndPriority>`) — an array of Input Mapping Contexts defining hardware-to-action bindings. Each entry has a `Priority` (higher wins on conflicts) and a `bRegisterWithSettings` flag that controls whether the IMC appears in the player's key-rebinding UI.

<img src=".gitbook/assets/image (1) (1) (1).png" alt="" title="Input Mapping asset">

### HeroComponent's DefaultInputMappings

`ULyraHeroComponent` has its own `DefaultInputMappings` property (`TArray<FInputMappingContextAndPriority>`). These IMCs are registered regardless of which PawnData is active, making them the right place for platform-specific overrides or controls shared across every pawn type (e.g., menu navigation, universal chat bindings).

### How They Combine

During `InitializePlayerInput`, the HeroComponent registers PawnData's `InputMappings` first, then its own `DefaultInputMappings`. Both sets are added to the `UEnhancedInputLocalPlayerSubsystem` with their respective priorities, so all IMCs are active simultaneously and priority determines which wins on hardware conflicts.

The practical split: PawnData defines pawn-specific controls (a vehicle's throttle/steer, a soldier's aim/fire), while `DefaultInputMappings` adds universal ones that survive pawn changes.

<details class="gb-toggle">

<summary>Initialization flow</summary>

```cpp
ULyraHeroComponent::InitializePlayerInput()
  1. Read PawnData->InputConfig --> bind native + ability actions on ULyraInputComponent
  2. For each PawnData->InputMappings entry:
       Add IMC to EnhancedInputSubsystem with its Priority
  3. For each DefaultInputMappings entry:
       Add IMC to EnhancedInputSubsystem with its Priority
  --> All IMCs now active; priority resolves conflicts
```

</details>

***

## Modular Input with Game Features

Game Features can inject input at runtime without modifying the base pawn. Two Game Feature Actions handle this, each targeting a different layer of the input stack.

### `GameFeatureAction_AddInputBinding`

Adds `ULyraInputConfig` assets (logical bindings) when the feature activates. For each pawn that is ready to bind inputs (signaled by `NAME_BindInputsNow`), it calls `ULyraHeroComponent::AddAdditionalInputConfig`, which binds the config's ability actions on the pawn's input component. On deactivation, bindings are removed via `RemoveAdditionalInputConfig`.

The configs are referenced through `TSoftObjectPtr<const ULyraInputConfig>`, so they load lazily only when the feature activates.

**When to use:** A game feature introduces new abilities that need input bindings, a vehicle mode adding drive/brake, a gadget system adding gadget activation.

<img src=".gitbook/assets/image (3) (1) (1).png" alt="" title="Input binding game feature action in experience data asset">

### `GameFeatureAction_AddInputContextMapping`

Adds Input Mapping Contexts (hardware bindings) to the Enhanced Input subsystem for local player controllers. Each entry carries a `Priority` and a `bRegisterWithSettings` flag; when true, the IMC registers with the Input Registry subsystem so its actions appear in the rebinding UI.

This action hooks into two lifecycle stages: registration (`OnGameFeatureRegistering`) handles settings-registry enrollment, while activation injects the actual mapping contexts into the subsystem. Deactivation and unregistration reverse both steps.

**When to use:** A game feature needs new hardware-to-action mappings, adding gamepad bindings for a keyboard-only feature, or a vehicle mode that remaps WASD to throttle/steer.

<img src=".gitbook/assets/image (4) (1) (1).png" alt="" title="input mapping gamefeature action in experience data asset">

### When to Use Which

| Action                     | What it adds                 | Layer                       |
| -------------------------- | ---------------------------- | --------------------------- |
| **AddInputBinding**        | Input Action to Gameplay Tag | Logical (tag routing)       |
| **AddInputContextMapping** | Hardware key to Input Action | Physical (hardware mapping) |

Most features that introduce new abilities only need **AddInputBinding**, the hardware mappings already exist or are covered by the base PawnData. **AddInputContextMapping** is for when the feature needs new or overridden hardware-to-action relationships.

***

## Ability Set Input Tags

Abilities don't reference input directly. The connection happens entirely through Gameplay Tags at grant time.

Each entry in a `ULyraAbilitySet`'s `GrantedGameplayAbilities` array is an `FLyraAbilitySet_GameplayAbility` struct with an `InputTag` field. When `GiveToAbilitySystem` grants the ability, it adds this tag to the ability spec's `DynamicSpecSourceTags`:

```cpp
AbilitySpec.GetDynamicSpecSourceTags().AddTag(AbilityToGrant.InputTag);
```

When the player presses a key, the HeroComponent calls `Input_AbilityInputTagPressed(Tag)`, which forwards to `ULyraAbilitySystemComponent::AbilityInputTagPressed(Tag)`. The ASC searches all ability specs for ones whose `DynamicSpecSourceTags` contain that tag, then activates them. Neither the input layer nor the ability class references the other, the tag is the only coupling.

### The Full Chain

```cpp
IMC:         Space Bar  -->  IA_Jump                        (hardware to action)
InputConfig: IA_Jump    -->  InputTag.Ability.Jump           (action to tag)
AbilitySet:  GA_Jump granted with InputTag.Ability.Jump      (tag on ability spec)

Player presses Space
  --> IA_Jump fires
  --> InputTag.Ability.Jump dispatched
  --> ASC finds GA_Jump (has matching DynamicSpecSourceTag)
  --> GA_Jump activates
```

The `InputTag` in the AbilitySet entry must match a tag in the active `InputConfig`'s `AbilityInputActions` array. If there is no matching config entry, the tag is never dispatched and the ability cannot be input-activated.
