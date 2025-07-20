# Setup & Integration

Enabling the core functionality of the Immersive Spectator System within your game modes is designed to be straightforward, primarily involving the inclusion of a dedicated [Lyra Experience Action Set](../../../base-lyra-modified/gameframework-and-experience/experience-primary-assets/experience-action-set.md): `LAS_ShooterBase_Spectator`.

<img src=".gitbook/assets/image (184).png" alt="" title="Blueprint Spectator Logic in ShooterBase">

### Simplicity via Action Sets

Instead of manually adding individual components and abilities required for spectating, the system leverages Lyra's Action Set framework. By adding this single Action Set to your game mode's Experience Definition, you activate the necessary pieces required for both the data replication (proxy/container) and the basic spectating initiation and control logic.

### Activation Method

1. **Identify Target Experience:** Open the [`ULyraExperienceDefinition`](../../../base-lyra-modified/gameframework-and-experience/experience-primary-assets/experience-definition.md) asset corresponding to the game mode or experience where you want players to have the ability to spectate teammates after death (e.g., `B_Experience_TeamDeathmatch`, `B_Experience_Elimination`).
2. **Add Action Set:**
   * Find the **Action Sets** array property in the Details panel of the Experience Definition.
   * Click the **+** icon to add a new entry to the array.
   * In the dropdown for the new entry, select the `LAS_ShooterBase_Spectator` asset.
3. **Save:** Save the `ULyraExperienceDefinition` asset.

Adding this Action Set ensures that the following configurations are applied automatically when the experience loads.

### Action Set Breakdown (`LAS_ShooterBase_Spectator`)

This Action Set contains several specific [GameFeatureAction](../../../base-lyra-modified/gameframework-and-experience/game-features/) instances configured to set up the spectator system:

1. [**`GameFeatureAction_AddComponents`**](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-components.md) **(Adds `USpectatorDataProxy`)**
   * **Target Actor:** `APlayerState` (or relevant subclass).
   * **Component Class:** `USpectatorDataProxy`.
   * **Spawn Condition:** Client & Server. The proxy needs to exist on the server to manage subscriptions and own the container, and on the client to listen for local state changes (like camera mode) and potentially for killcam interactions.
   * **Uniqueness Check:** This action implicitly (or explicitly, depending on implementation details not shown but assumed common practice) ensures only one instance of `USpectatorDataProxy` is added per Player State. This prevents conflicts if another system (like the Killcam Action Set) also requests this component.
2. [**`GameFeatureAction_AddAbilities`**](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-abilities.md) **(Adds Core Spectating Abilities)**
   * **Target Actor:** `ALyraPlayerState` (or relevant subclass with an ASC).
   * **Granted Items:**
     * Grants the base `GA_Spectate` ability. This allows the player state's ASC to initiate the server-side live spectating flow upon death trigger.
     * Grants an **Ability Set** (`AbilitySet_Spectator`). This set contains:
       * `GA_Spectate_Next`: Linked via its internal InputTag to InputTag.Ability.Spectator.WatchNext.
       * `GA_Spectate_Previous`: Linked via its internal InputTag to `InputTag.Ability.Spectator.WatchPrevious`.
     * Granting these via an Ability Set simplifies management and ensures the input bindings work correctly.
3. [**`GameFeatureAction_AddInputBinding`**](../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-input-binding.md) **(Adds Spectator Input Config)**
   * **Target Actor:** `APawn` (specifically listens for `ULyraHeroComponent` readiness).
   * **Input Config:** Adds a `ULyraInputConfig` asset (`InputData_Spectator`). This asset performs the crucial mapping:
     * Maps `InputTag.Ability.Spectator.WatchNext` to the input action `IA_Spectate_Next`.
     * Maps `InputTag.Ability.Spectator.WatchPrevious` to the input action `IA_Spectate_Previous`.
   * This action ensures that when the player possesses the `ATeammateSpectator`, pressing the physical keys added in the input mapping context that reference the "Watch Next/Previous" input actions will correctly trigger the corresponding Gameplay Abilities.

### Dependencies and Assumed Setup

Adding the `LAS_ShooterBase_Spectating` Action Set assumes that the Experience also includes the necessary setup for:

* **Core GAS:** Players need an `UAbilitySystemComponent` (specifically `ULyraAbilitySystemComponent`) on their `APlayerState`.
* **Team System:** `ULyraTeamSubsystem` must be active and functional for teammate identification.
* **Gameplay Messages:** The `UGameplayMessageSubsystem` must be active.
* **Player Pawns:** Player pawns should ideally use `ULyraCameraComponent` for seamless camera mode mimicking.
* **Quickbar:** Players need `ULyraQuickBarComponent` on their controller for the quickbar data to be available.
* **Inventory:** `ULyraInventoryManagerComponent` is needed on controllers for the ammo query system to function.
* **Death Trigger:** Logic must exist (likely in another ability granted by the experience or game mode) to trigger the `GA_Spectate` ability upon player death confirmation.
* **Enhanced Input:** Input Actions for "`Spectate Next`" and "`Spectate Previous`" must be defined in the project's input settings and mapped to physical keys/buttons in an appropriate Input Mapping Context that is active during spectating.

Usually, standard Lyra/Shooter Base experiences will already include these dependencies.

### Summary

Integrating the core Immersive Spectator System for live teammate spectating is primarily achieved by adding the `LAS_ShooterBase_Spectating` Lyra Experience Action Set to your desired game mode's `ULyraExperienceDefinition`. This set bundles the necessary actions to add the `USpectatorDataProxy` component, grant the required Gameplay Abilities (`GA_Spectate`, `GA_Spectate_Next`, `GA_Spectate_Previous`), and set up the input bindings for target cycling. Ensure the experience also fulfills the underlying system dependencies (GAS, Teams, Camera, Quickbar, Input Actions).
