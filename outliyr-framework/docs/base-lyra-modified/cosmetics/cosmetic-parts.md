# Cosmetic Parts

A cosmetic part is an actor that attaches to the character, a helmet, a backpack, a visor. Each part can carry gameplay tags that influence which body mesh and animation layers the character uses. The system handles spawning, replication, and persistence across respawns through two cooperating components: one on the player controller (the desired state) and one on the pawn (the visual work).

***

### What a Part Is

A part is defined by an actor class to spawn, a socket to attach to (or the mesh root if unspecified), and a collision mode. Collision is either disabled entirely or left as-is from the part actor's own settings.

Parts can also carry extra gameplay tags as metadata. These tags travel with the part without requiring the spawned actor to implement a tag interface, useful for tagging parts with gameplay-relevant state that other systems can query.

You can create a part with no actor class at all, just tags. This adds metadata to the tag collection without spawning anything visible. For example, a tag-only part might mark that a character has heavy armor equipped, which drives body mesh selection without needing a dedicated cosmetic actor.

<details>

<summary>In code: MakeTagOnlyPart</summary>

`FLyraCharacterPart::MakeTagOnlyPart(Tags)` creates a part with no `PartClass`, just `ExtraTags`. No actor is spawned, but the tags contribute to `GetCombinedTags()`. Use this for cosmetic metadata that drives body mesh or animation selection without needing a visible actor.

</details>

#### Dedicated Server Behaviour

Cosmetic parts are **not spawned on dedicated servers**. This is handled explicitly inside `FLyraCharacterPartList::SpawnActorForEntry`, which includes a check to skip spawning cosmetic part actors on dedicated servers.

This has several important implications:

* **Performance Optimization:** No CPU or memory is spent managing cosmetic-only actors on a server nobody visually observes.
* **Listen Server Exception:** If the server is also running a local player (i.e., it’s a _Listen Server_), cosmetics **are** spawned for that local player only.
* **Empty Arrays on Server:** If you call `GetCharacterPartActors()` on a dedicated server, it will return an **empty array**, even if parts are technically “applied” in the replicated list. This is not a bug, it’s because no part actors exist on the server.

{% hint style="success" %}
**Be cautious** when writing logic that **iterates over cosmetic part actors**, always account for the possibility that no actors are spawned if running in a server-only context.
{% endhint %}

{% hint style="danger" %}
Parts are never spawned on dedicated servers, only on clients/listen server who benefit from visualising cosmetics.
{% endhint %}

***

### The Controller Component

`ULyraControllerComponent_CharacterParts` lives on the player controller. This component stores the list of parts the player wants applied to their character. Because the player controller outlives the pawn, this list survives death and respawn. You manage it through `AddCharacterPart()` to add a part, `RemoveCharacterPart()` to remove a specific part by definition, and `RemoveAllCharacterParts()` to clear everything.

<figure><img src="../../.gitbook/assets/image (262).png" alt=""><figcaption><p>Example of randomly picking a male or female mannequin when the game starts</p></figcaption></figure>

{% hint style="success" %}
**Arena Gamemode Plugin** has character selection logic, which serves as a more complex example of how this system can be used.
{% endhint %}

When the controller possesses a new pawn:

{% stepper %}
{% step %}
#### Possession changes

The controller detects a new pawn via the `OnPossessedPawnChanged` delegate (server authority only).
{% endstep %}

{% step %}
#### Remove from old pawn

If there was a previous pawn, all parts are removed from its pawn component and the handles are reset.
{% endstep %}

{% step %}
#### Apply to new pawn

Each desired part that doesn't already have a valid handle (and isn't suppressed) is added to the new pawn's cosmetic component. The returned handles are stored so parts can be individually removed later.
{% endstep %}
{% endstepper %}

This is why cosmetics survive respawns, the desired state lives on the controller, not the pawn.

#### Key Operations

| Method                    | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `AddCharacterPart`        | Adds a cosmetic part that persists across respawns |
| `RemoveCharacterPart`     | Removes a part by definition                       |
| `RemoveAllCharacterParts` | Clears all character parts                         |

***

### The Pawn Component

`ULyraPawnComponent_CharacterParts` lives on the pawn. This component handles the actual spawning of cosmetic actors and their replication to all clients. It exposes `AddCharacterPart()` and `RemoveCharacterPart()`  to manage individual parts, `RemoveAllCharacterParts()` to clear everything, and `GetCharacterPartActors()` to retrieve all currently spawned part actors.

<figure><img src="../../.gitbook/assets/image (260).png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (259).png" alt=""><figcaption><p>Lyra's Default Cosmetic Manager <code>B_MannequinPawnCosmetics</code></p></figcaption></figure>

When a part is added:

{% stepper %}
{% step %}
#### Server adds the part

The controller component calls `AddCharacterPart` on the pawn component (server authority only). The part is appended to the replicated list and marked dirty for replication.
{% endstep %}

{% step %}
#### Actor is spawned locally

If the part has an actor class and **this isn't a dedicated server**, a child actor component is created, set to the part's class, and attached to the specified socket on the character's mesh.
{% endstep %}

{% step %}
#### Collision is configured

Based on the part's collision mode, collision is either disabled on the spawned actor or left alone.
{% endstep %}

{% step %}
#### Replication to clients

The part list replicates to all clients via delta serialization. Each client receives the addition and spawns the cosmetic actor locally through the same spawn path.
{% endstep %}

{% step %}
#### Tags are collected and broadcast

The pawn component collects gameplay tags from all spawned parts and fires a change delegate. Body mesh selection and animation systems react to the updated tag set.

<figure><img src="../../.gitbook/assets/image (261).png" alt=""><figcaption></figcaption></figure>
{% endstep %}
{% endstepper %}

#### Key Operations

| Method                              | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `AddCharacterPart`                  | Spawns a cosmetic part on the pawn (authority only) |
| `RemoveCharacterPart`               | Removes a part by handle                            |
| `RemoveAllCharacterParts`           | Clears all spawned parts                            |
| `GetCharacterPartActors`            | Returns all spawned part actors                     |
| `GetCombinedTags`                   | Collects gameplay tags from all attached parts      |
| Delegate: `OnCharacterPartsChanged` | Fires when the parts list changes                   |

***

### Tag Collection

The pawn component collects gameplay tags from all spawned cosmetic actors that implement the gameplay tag asset interface, plus any extra tags defined directly on the parts. These combined tags drive body mesh selection and animation layer selection (see [body-style-and-animation](body-style-and-animation.md)).

External systems can bind to the `OnCharacterPartsChanged` delegate to react whenever cosmetics change, for example, to apply team coloring to newly spawned part actors.

***

### Replication

Parts replicate using delta serialization, only changes are sent, not the full list every time. When a part is added on the server, clients receive the addition and spawn the actor locally. When a part is removed, clients destroy the actor. When a part changes, clients destroy the old actor and respawn it, there is no fine-grained update path.

**On dedicated servers, cosmetic actors are never spawned**. The part data replicates but the visual actors are only created on clients.

<details>

<summary>Why two components instead of one?</summary>

The controller component persists across respawns because the player controller outlives the pawn. If cosmetics were stored only on the pawn, they'd be lost on death. The split means the pawn handles the ephemeral visual work (spawning actors, collecting tags, broadcasting changes) while the controller holds the persistent desired state. When a new pawn is possessed, the controller simply re-applies its list to the fresh pawn component.

</details>
