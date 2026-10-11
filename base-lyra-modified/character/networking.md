# Networking

In a multiplayer game your character exists simultaneously on the server and every connected client. The server is authoritative, it decides whether your shot landed, whether you took damage, and how much health you have left. But the client needs to show all of this instantly, without waiting for a round trip.

A networked character is actually two actors cooperating. The **ASC** lives on the `PlayerState` and handles abilities, gameplay effects, and attributes, persistent state that survives death and respawn. The **pawn** (`ALyraCharacter`) handles movement, collision, and visual state, transient state tied to the current physical body. Each actor replicates through its own channel with its own strategy, and understanding what replicates where is essential.

***

## ASC Replication

GAS offers three replication modes for the Ability System Component. The framework uses **Mixed** on all ASC owners (`LyraPlayerState`, `LyraCharacterWithAbilities`, `LyraGameState`, and `ActorWithAbility`).

Mixed mode gives each network role a different level of detail:

* **The owning player** sees full detail on all their effects, every buff, debuff, and cooldown replicates so the client can show accurate timers, stacking counts, and attribute modifiers.
* **Other players** only receive gameplay cues and tags. They see the visual effects (fire particles, shield glow) and can check state indicators (stunned, dead), but they never know the internal details of another player's effects.
* **The server** has everything. It is the authoritative source for all effect and attribute data.

**What replicates and to whom:**

| Data                           | Owning Client                                 | Other Clients                 | Server        |
| ------------------------------ | --------------------------------------------- | ----------------------------- | ------------- |
| Gameplay Effects (full detail) | Yes                                           | No                            | Authoritative |
| Gameplay Cues                  | Yes                                           | Yes                           | Authoritative |
| Attribute base values          | Yes (via `OnRep`)                             | Yes (via `OnRep`)             | Authoritative |
| Attribute current values       | Derived from replicated effects + base values | Derived from base values only | Authoritative |

When the server changes an attribute like Health or Shield, the new base value replicates to all clients. On the owning client, the replicated value is reconciled with any locally predicted changes so the player never sees a jarring snap. On other clients, base values arrive directly since they have no local predictions to reconcile.

### Movement Compression

A character's acceleration is three floats, 24 bytes per update. Sending that every frame to every simulated proxy across a full lobby adds up fast. The framework compresses this down to **3 bytes** by converting the XY plane to polar coordinates and quantizing everything.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Server pre-replication**

Before replication, the server takes the current acceleration vector and compresses it: the XY direction becomes 1 byte, the XY magnitude becomes 1 byte, and the Z component becomes 1 byte. Three bytes total instead of twenty-four.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Replication**

The 3-byte struct is sent to simulated proxies only. The owning client computes acceleration from its own input, so it never needs the compressed version.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Client receives**

Simulated proxies decompress the 3 bytes back into a full acceleration vector and feed it into the movement component. This drives smooth visual interpolation of the character's movement on other players' screens.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

The compression is lossy, quantizing to 256 steps per axis discards precision. But simulated proxies only use this for visual interpolation, not authoritative physics, so the loss is imperceptible in practice.

***

## Shared Movement Replication

Standard Unreal movement replication goes through the property replication system, which can be throttled or delayed by the engine's net update frequency. For smoother results, the framework uses a custom path that bypasses property-level throttling entirely.

A dedicated struct batches together everything needed to represent a character's movement state: position, rotation, velocity, movement mode, jump state, crouch state, and a timestamp. This struct is sent via an **unreliable multicast RPC**, which means lost packets are simply superseded by the next update rather than retransmitted.

<!-- gb-stepper:start -->
<!-- gb-step:start -->
**Authority fills the struct**

On the server, the current movement state is read from the character and packed into the shared struct, location, rotation, velocity, movement mode, whether jump force is active, and whether the character is crouched.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Authority diffs against last sent**

The struct is compared against the last version that was sent. If nothing changed, nothing is sent, and clients that already received the previous update can skip this frame entirely.
<!-- gb-step:end -->

<!-- gb-step:start -->
**Clients receive and apply**

All simulated proxies receive the multicast and apply the movement state directly, setting position, rotation, velocity, movement mode, jump force, and crouch state. Stale updates are rejected using the timestamp.
<!-- gb-step:end -->
<!-- gb-stepper:end -->

***

## Net Update Frequency

Both `PlayerState` and `LyraCharacterWithAbilities` set their net update frequency to **100 Hz**. The ASC requires high-frequency updates so that gameplay effects and attribute changes replicate responsively, a heal or damage event should not wait for a slow replication tick to reach the client.
