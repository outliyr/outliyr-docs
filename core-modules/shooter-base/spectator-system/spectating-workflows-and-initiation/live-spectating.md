# Live Spectating

Live spectating allows players, typically after being eliminated in a team-based game mode, to observe the ongoing match from the perspective of their remaining living teammates. This process is primarily managed on the server using the `GA_Spectate` Gameplay Ability.

### Context and Trigger

* **Context:** Server-Authoritative. The decision to start spectating, who to spectate initially, and the possession of the spectator pawn are all handled by server logic.
* **Trigger:** This ability is usually granted to the `ALyraPlayerState`. It's typically activated automatically when the player's character is confirmed dead. This might be triggered by:
  * Listening for a specific Gameplay Event (e.g., `GameplayEvent.Player.Death`).
  * Being part of a death-handling Ability Set.
  * Direct activation by server-side game mode logic upon confirming elimination.
* **AI Exclusion:** The ability includes checks (`!PlayerController->PlayerState->IsABot()`) to prevent AI controllers from attempting to spectate.

### Execution Flow (GA_Spectate Activation - Server)

When `GA_Spectate` activates on the server for a player controller:

1. **Listen for Possession:** It first sets up an internal listener for the `ShooterGame.Spectator.Message.Possessed` message. This is likely a safeguard or timing mechanism to know precisely when the subsequent possession completes before proceeding with target setup.
2. **Spawn Spectator Pawn:** It spawns an instance of the `ATeammateSpectator` pawn class in the world.
3. Add Spectator Input Mapping Context: This adds input mapping context (`IMC_Spectator`) locally to the player. This updates enhanced inputs during runtime to map the spectator related input actions to the physical input keys/buttons.&#x20;
4. **Add Spectator widgets**: It creates widgets defined in the ability. In this case they are custom widgets designed specifically for spectating. They are similar to their original widgets except they listening for changes from the `SpectatorDataContainer` instead of the owner of the widget (the spectator).&#x20;
5. **Possess Spectator Pawn:** It forces the activating player's `AController` to possess the newly spawned `ATeammateSpectator`.
6. **Mark as Spectator:** It calls `USpectatorFunctionLibrary::SetPlayerStateSpectating(true)` on the player's `ALyraPlayerState`. This updates the engine's internal spectator state for the player.
7. **Initial Target Selection:**
   * It retrieves the player's TeamId using `ULyraTeamSubsystem`.
   * It calls `ATeammateSpectator::PopulatePlayerTeam(TeamId)` on the possessed spectator pawn. This fills the pawn's internal list with potential teammates to watch.
   * It attempts to find the first valid teammate to watch by calling `ATeammateSpectator::WatchNextPawn()`. This function automatically selects the first living teammate in the populated list.
   * **Fallback (No Teammates Alive):** If `WatchNextPawn()` fails to find a living teammate (returns false), the ability logic uses the `KillerPlayerState` (this is passed as the instigator) and populates the killer's team and allows the player to watch them. If there team gets wiped out it gets passed on to their killer, and so on. This allows players to watch their killer if their whole team is wiped out.
8. **Server Subscription:** After a target is selected (`SetObservedPawn` or `SpectatePlayerState` is called internally), the `ATeammateSpectator`'s `SpectatingPlayerChanged` function executes. Crucially, this calls `Server_SetSpectatedPlayer(ObservedPlayerState)`. This function (running on the `ATeammateSpectator`, which is server-controlled here) directly calls `USpectatorDataProxy::SetSpectatorSubscribed` on the target player's `PlayerState`'s proxy, adding the spectating player's controller to the subscription list. This authorizes the replication of the `USpectatorDataContaine`r and its contents to the spectator client.
9. **Ability Ends:** `GA_Spectate` ends when it detects the player is no longer possessing the `TeammateSpectator`. So in this case when the player respawns, they possess the new respawned character, this automatically ends the ability, which removes all input mapping context and spectator widgets.

### Changing Targets (Input Driven)

While `GA_Spectate` handles the initiation, changing targets during live spectating is usually driven by player input, managed by separate abilities granted alongside `GA_Spectate`:

* `GA_Spectate_Next` **/** `GA_Spectate_Previous`**:** These abilities are granted via the `LAS_ShooterBase_Spectating` Ability Set and tied to specific Input Tags (e.g., `InputTag.Ability.Spectator.WatchNext`).
* **Activation:** When the player presses the corresponding input button:
  1. The input action triggers the ability via the Input Tag mapping (setup by [`GameFeatureAction_AddInputBinding`](../../../../base-lyra-modified/gameframework-and-experience/game-features/game-feature-actions/add-input-binding.md)).
  2. The `GA_Spectate_Next`/Previous ability activates.
  3. The ability logic gets the player's currently possessed pawn, casts it to `ATeammateSpectator`.
  4. It calls the corresponding function on the spectator pawn: `ATeammateSpectator::WatchNextPawn()` or `ATeammateSpectator::WatchPreviousPawn()`.
  5. The `ATeammateSpectator` handles finding the next/previous living teammate and calls `SetObservedPawn`.
  6. `SetObservedPawn` triggers `SpectatingPlayerChanged`, which calls `Server_SetSpectatedPlayer`. This updates the server-side subscription, unsubscribing from the old target's proxy and subscribing to the new target's proxy.

### Data Flow Summary (Live Spectating)

1. Spectated player's state changes (e.g., switches weapon, changes camera mode, uses ammo).
2. **Server State:** Quickbar changes are detected server-side by the spectated player's `USpectatorDataProxy` -> Updates `USpectatorDataContainer`. Inventory ammo queries update weapon stat tags server-side -> Replicated via weapon instance.
3. **Client State:** Camera/ADS changes detected client-side by spectated player's `USpectatorDataProxy` -> Server RPC -> Server updates `USpectatorDataContainer`.
4. `USpectatorDataContainer` properties replicate to subscribed spectator(s).
5. `OnRep_` functions fire on spectator client -> Broadcast local messages.
6. Spectator's `ATeammateSpectator` and UI widgets react to local messages, updating camera and display.

### Summary

Live teammate spectating is orchestrated primarily on the server by the `GA_Spectate` ability. It handles possessing the dedicated `ATeammateSpectator` pawn and setting up the initial target and server-side data subscription. Target cycling is managed through separate input-driven abilities that call functions on the possessed `ATeammateSpectator`. The core data flow relies on the proxy/container system to selectively replicate state from the target player to the spectator client, enabling the immersive view.
