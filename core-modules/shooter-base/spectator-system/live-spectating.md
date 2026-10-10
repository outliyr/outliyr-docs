# Live Spectating

Live spectating allows players, typically after being eliminated in a team-based game mode, to observe the ongoing match from the perspective of their remaining living teammates. This process is primarily managed on the server using the `GA_Spectate` Gameplay Ability.

### Context and Trigger

* **Context:** Server-Authoritative. The decision to start spectating, who to spectate initially, and the possession of the spectator pawn are all handled by server logic.
* **Trigger:** This ability is usually granted to the `ALyraPlayerState`. It's typically activated automatically when the player's character is confirmed dead. This might be triggered by:
  * Listening for a specific Gameplay Event (e.g., `GameplayEvent.Player.Death`).
  * Being part of a death-handling Ability Set.
  * Direct activation by server-side game mode logic upon confirming elimination.
* **AI Exclusion:** The ability includes checks (`!PlayerController->PlayerState->IsABot()`) to prevent AI controllers from attempting to spectate.

> [!INFO]
> Spectating is server-driven: the server grants/activates the ability, spawns and possesses the spectator pawn, and manages which player state data is replicated to the spectator.

## Execution Flow of `GA_Spectate`

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Listen for Possession

Sets up an internal listener for the `ShooterGame.Spectator.Message.Possessed` message. This acts as a safeguard/timing mechanism to detect when possession completes before proceeding with target setup.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Spawn Spectator Pawn

Spawns an instance of the `ATeammateSpectator` pawn class into the world.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add Spectator Input Mapping Context

Adds the input mapping context `IMC_Spectator` locally to the player so enhanced inputs map spectator actions to physical keys/buttons.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Add Spectator Widgets

Creates the widgets defined in the ability. These are custom spectator widgets that listen for changes from the `SpectatorDataContainer` (rather than the widget owner).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Possess Spectator Pawn

Forces the activating player's `AController` to possess the newly spawned `ATeammateSpectator`.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Mark as Spectator

Calls `USpectatorFunctionLibrary::SetPlayerStateSpectating(true)` on the player's `ALyraPlayerState` to update the engine's internal spectator state.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Initial Target Selection

* Retrieves the player's TeamId using `ULyraTeamSubsystem`.
* Calls `ATeammateSpectator::PopulatePlayerTeam(TeamId)` to fill the pawn's internal list of potential teammates to watch.
* Attempts to find the first valid teammate via `ATeammateSpectator::WatchNextPawn()`, which automatically selects the first living teammate in the populated list.
* Fallback: If no teammates are alive, the ability uses the `KillerPlayerState` (passed as the instigator), populates the killer's team, and allows the player to watch them. If that team is wiped out, this can chain to the killer's killer, etc., enabling watching the killer when your entire team dies.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Server Subscription

After a target is selected (via `SetObservedPawn` or `SpectatePlayerState`), `ATeammateSpectator`'s `SpectatingPlayerChanged` executes and calls `Server_SetSpectatedPlayer(ObservedPlayerState)`. On the server-controlled `ATeammateSpectator`, this calls `USpectatorDataProxy::SetSpectatorSubscribed` on the target player's proxy, adding the spectating player's controller to the subscription list. This authorizes replication of the `USpectatorDataContainer` and its contents to the spectator client.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Ability Ends

`GA_Spectate` ends when the player is no longer possessing the `ATeammateSpectator` (for example, when the player respawns and possesses their new character). Ending the ability removes the input mapping context and spectator widgets.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

## Changing Targets (Input Driven)

While `GA_Spectate` handles initiation, changing targets during live spectating is input-driven and implemented by separate abilities granted with `GA_Spectate`:

* `GA_Spectate_Next` / `GA_Spectate_Previous`: Granted via the `LAS_ShooterBase_Spectating` Ability Set and tied to Input Tags (e.g., `InputTag.Ability.Spectator.WatchNext`).

<!-- gb-stepper:start -->
<!-- gb-step:start -->
### Input Trigger

Player presses the corresponding input button; the input action triggers the ability via Input Tag mapping (configured by GameFeatureAction_AddInputBinding).
<!-- gb-step:end -->

<!-- gb-step:start -->
### Ability Activation

`GA_Spectate_Next` / `GA_Spectate_Previous` activates.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Pawn Cast

The ability logic gets the player's currently possessed pawn and casts it to `ATeammateSpectator`.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Watch Next/Previous

Calls `ATeammateSpectator::WatchNextPawn()` or `ATeammateSpectator::WatchPreviousPawn()`.
<!-- gb-step:end -->

<!-- gb-step:start -->
### Server Subscription Update

`ATeammateSpectator` finds the next/previous living teammate and calls `SetObservedPawn`, which triggers `SpectatingPlayerChanged` and `Server_SetSpectatedPlayer`. The server unsubscribes from the old target's proxy and subscribes to the new target's proxy.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

## Data Flow Summary (Live Spectating)

1. Spectated player's state changes (weapon switch, camera mode, ammo usage).
2. Server-side:
   * Quickbar changes detected by the spectated player's `USpectatorDataProxy` update `USpectatorDataContainer`.
   * Inventory/ammo updates propagate via weapon instance replication and weapon stat tags.
3. Client-side:
   * Camera/ADS changes detected client-side by the spectated player's `USpectatorDataProxy` -> sent via Server RPC -> server updates `USpectatorDataContainer`.
4. `USpectatorDataContainer` properties replicate to subscribed spectator(s).
5. `OnRep_` functions run on the spectator client and broadcast local messages.
6. Spectator's `ATeammateSpectator` and UI widgets respond to those messages, updating camera and display.

## Summary

Live teammate spectating is orchestrated primarily on the server via the `GA_Spectate` ability. It spawns and possesses a dedicated `ATeammateSpectator` pawn, initializes the initial target and server-side subscription, and ends when the player regains control of a respawned character. Target cycling is handled by separate input-driven abilities which instruct the possessed spectator pawn to change its observed target. The proxy/container replication system selectively replicates the target player's state to subscribing spectators, enabling the immersive spectator view.
