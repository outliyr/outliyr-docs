# Replication & Networking

A core strength of this asset, inherited from Lyra, is its robust design for multiplayer networking. Ensuring character movement, actions, and state are synchronized efficiently and appear smooth across all clients is paramount for a shooter. This page covers the key networking strategies employed.

### General Approach

The character system utilizes several layers of Unreal Engine's networking capabilities:

1. **Standard Property Replication:** Many core properties on actors and components (`APawn`, `ACharacter`, `UActorComponent`) use Unreal's standard `UPROPERTY(Replicated)` or `ReplicatedUsing=FunctionName` system. Examples include the Controller, Player State, `ULyraHealthComponent::DeathState`, `ULyraPawnExtensionComponent::PawnData`, and `ALyraCharacter::MyTeamID`.
2. **Gameplay Ability System (GAS) Replication:** The `ULyraAbilitySystemComponent` itself handles much of the replication related to abilities and stats:
   * **Gameplay Effects:** Active effects are replicated according to the ASC's `ReplicationMode` (typically `Mixed` - important effects replicate, others don't; or `Full` - all effects replicate).
   * **Attribute Values:** Base values are replicated. Current values change due to replicated Gameplay Effects. Direct changes often require careful handling (e.g., using an effect or ensuring replication elsewhere). `OnRep_` functions in Attribute Sets (`ULyraHealthSet::OnRep_Health`) are primarily used for client-side prediction adjustments or cosmetic updates after the server's replicated value arrives.
   * **Gameplay Tags:** Tags added/removed via replicated Gameplay Effects are synchronized. Loose tags (added directly via C++) generally require manual replication if needed on clients.
   * **Ability Activation:** Ability activation state and relevant data are handled by GAS's internal replication mechanisms.
3. **Remote Procedure Calls (RPCs):** Used for specific events or actions that need to be explicitly triggered across the network (e.g., `Client`, `Server`, `NetMulticast`). The Fast Shared Replication (`FastSharedReplication`) uses a multicast RPC.
4. **Custom Replication Structures:** For performance-critical data like movement, custom structures and serialization methods are used to optimize bandwidth (`FLyraReplicatedAcceleration`, `FSharedRepMovement`).

### Optimized Movement Replication

Standard `ACharacter` movement replication can be bandwidth-intensive. Lyra introduces optimizations for smoother visuals and potentially lower overhead, especially for simulated proxies (other clients' characters).

**1. `FLyraReplicatedAcceleration` (Compressed Acceleration)**

* **Purpose:** To replicate the character's current physics acceleration vector (`UCharacterMovementComponent::GetCurrentAcceleration`) in a compressed format. This helps simulated proxies better predict future movement, leading to smoother visuals even with some latency or packet loss.
* **Structure (`FLyraReplicatedAcceleration`):**
  * `AccelXYRadians`: `uint8` representing XY direction (0-255 maps to 0-2π).
  * `AccelXYMagnitude`: `uint8` representing XY magnitude (0-255 maps to 0-MaxAcceleration).
  * `AccelZ`: `int8` representing Z component (-127 to 127 maps to -MaxAcceleration to +MaxAcceleration).
* **Calculation (`ALyraCharacter::PreReplication`):** Before replicating properties, the character calculates its current acceleration, converts the XY components to polar coordinates (magnitude and angle), quantizes these values and the Z component into the structure's fields.
* **Replication:** Replicated using `DOREPLIFETIME_CONDITION(..., ReplicatedAcceleration, COND_SimulatedOnly)`. It only needs to be sent to simulated proxies, as autonomous proxies and the server calculate acceleration locally.
* **Application (`ALyraCharacter::OnRep_ReplicatedAcceleration`):** When a simulated proxy receives this data, the `OnRep_` function decompresses the values back into a `FVector`.
* **Usage (`ULyraCharacterMovementComponent::SetReplicatedAcceleration` & `SimulateMovement`):** The decompressed acceleration is passed to the `ULyraCharacterMovementComponent`. The component's overridden `SimulateMovement` function uses this replicated acceleration during its physics calculations for simulated proxies, overriding the locally calculated acceleration.

**2. `FSharedRepMovement` (Fast Shared Replication)**

* **Purpose:** To provide a "fast path" for replicating essential movement data frequently via an unreliable multicast RPC. This is used when standard property replication might be skipped for optimization (e.g., if no other properties changed), ensuring simulated proxies still receive frequent updates for core movement parameters like location, rotation, velocity, and movement mode.
* **Structure (`FSharedRepMovement`):** Contains key movement data:
  * `RepMovement`: A standard `FRepMovement` struct (Location, Rotation, LinearVelocity, etc.). Uses `RoundTwoDecimals` quantization for location.
  * `RepTimeStamp`: Server timestamp for movement smoothing.
  * `RepMovementMode`: Packed representation of the character's movement mode.
  * `bProxyIsJumpForceApplied`: Tracks if jump force is active.
  * `bIsCrouched`: Current crouch state.
* **Filling (`FSharedRepMovement::FillForCharacter`):** Called on the server to populate the struct with the character's current state.
* **Sending (`ALyraCharacter::UpdateSharedReplication`):** Called on the server (likely per-tick or periodically). It fills a `FSharedRepMovement` struct and compares it to the `LastSharedReplication`. If the data has changed _and_ the character is in a state where fast replication is appropriate (e.g., has Authority), it calls the `FastSharedReplication` NetMulticast RPC, sending the _new_ data. This avoids sending redundant updates.
* **Receiving (`ALyraCharacter::FastSharedReplication_Implementation`):** Executed on all clients (including the server).
  * For _Simulated Proxies_: It applies the received data directly: sets the server timestamp, updates the replicated movement mode (forcing the `UCharacterMovementComponent` to acknowledge the change), updates the core `ReplicatedMovement` variable (triggering `OnRep_ReplicatedMovement`), and updates the jump and crouch states (calling `OnRep_IsCrouched` if needed).
  * Autonomous Proxies generally ignore this specific RPC's data application as they predict their own movement, but they still receive the RPC.
* **Serialization (`FSharedRepMovement::NetSerialize`):** Custom serialization logic optimizes how the data is packed into the network stream (e.g., only sending the timestamp if it's non-zero).
* **NetSharedSerialization:** Uses `TStructOpsTypeTraits` to mark it for potential engine-level optimizations related to shared serialization contexts.
* **Relationship to Standard Movement:** Fast Shared Replication complements, rather than entirely replaces, standard `AActor::bReplicateMovement` and `ACharacter` movement replication. It ensures critical data gets through frequently even if other property updates are skipped, improving smoothness for simulated proxies.

### Other Replicated States & Considerations

* **Team ID (`ALyraCharacter::MyTeamID`, `ALyraPawn::MyTeamID`):** Replicated with an `OnRep_MyTeamID` function that broadcasts team changes locally using `ConditionalBroadcastTeamChanged`.
* **Death State (`ULyraHealthComponent::DeathState`):** Replicated using `OnRep_DeathState`. This `OnRep` handles client-side prediction correction; if the client predicted getting into a death state before the server confirmed it, it logs it but usually relies on the server state. It calls `StartDeath`/`FinishDeath` locally on the client to ensure visual/state consistency.
* **Pawn Data (`ULyraPawnExtensionComponent::PawnData`):** Replicated using `OnRep_PawnData`. This is crucial for clients to initialize correctly, as the `OnRep_` triggers `CheckDefaultInitialization`.
* **Replication Frequency & Priority:** Network performance can be tuned via actor/component settings like `NetUpdateFrequency`, `NetPriority`, and Cull Distance (`NetCullDistanceSquared`). `ALyraCharacterWithAbilities` specifically sets a high NetUpdateFrequency (100 Hz) because its ASC's state needs frequent updates.

### Summary

The character system employs a multi-layered networking strategy:

* Leverages GAS for ability and core attribute replication.
* Uses standard UE property replication for many states (`DeathState`, `TeamID`, `PawnData`).
* Implements custom optimizations (`FLyraReplicatedAcceleration`, `FSharedRepMovement`) for efficient and smooth networked movement, particularly focusing on the visual fidelity of simulated proxies.

This robust foundation provides a solid starting point for building responsive and visually convincing networked shooter experiences.

