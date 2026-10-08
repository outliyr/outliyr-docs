# Perspective Clips

Every machine records its own view of the match, and that view isn't the same everywhere. Each machine draws remote players a little late and smoothed, receives their aim coarsely, and never sees anyone else's first-person view. When a replay should show what *another* player saw, such as a kill seen through the killer's eyes, this machine's recording isn't good enough, but the other player's machine has exactly the right one. A **perspective clip** is that machine's recording of chosen actors, packed small enough to send, and played here in place of this machine's own recording of them.

This page covers what goes into a perspective clip, how it is encoded and decoded, how parts of one join together, and how a session merges it into a replay. How a clip travels between machines is up to the game. [Getting the Killer's Recording](../shooter-base/kill-cam/data-transfer-and-networking.md) describes how the kill cam does it.

***

## Building a Clip

The sending machine calls `BuildPerspectiveClip` with a list of **subjects**, the actors whose view matters, and a stretch of time. The clip takes:

* **every track that belongs to a subject**: its own meshes, anything attached to it, and anything it owns, such as a held weapon;
* **a few extra characters the sender had on screen**, up to a given number, chosen among the pawns whose poses were actually rendered on the sender's machine for at least a quarter of the window, most visible first;
* **the sender's camera**, so the replay can show exactly what the sender's player saw;
* **the cosmetics of those tracks**: effects, decals and lights attached to them or owned by a subject.

Events are left out. Every machine records the replicated ones itself, so the receiver already has them.

Subjects travel apart from the clip, as ordinary actor references the network resolves to the receiver's own copies of those actors. Inside the clip a track only says which subject it belongs to, so the clip never names an object the receiver doesn't have.

```
sender:
    clip  = Recorder->BuildPerspectiveClip(Subjects, Start, End, MaxExtraCharacters)
    bytes = VisualReplayClipCodec::EncodeAsync(clip)       // off the game thread
    send bytes, and the subjects as actor references

receiver:
    clip  = VisualReplayClipCodec::DecodeAsync(bytes)      // back on the game thread with assets resolved
    clip.Subjects = the received actor references
    first part:  Options.PerspectiveClip = clip, then start the session
    later parts: Session->AppendPerspectiveClip(part)
```

***

## The Codec

A raw clip is far too large to send: full transforms for every bone of every mesh at frame rate. The codec, `VisualReplayClipCodec`, shrinks it in stages, each removing a different kind of waste.

| Stage | What it does | Why it is safe |
| --- | --- | --- |
| Leave out what the receiver can't see | Drops the poses of a skeletal mesh with no material, unless something hangs from it. Sends a bone that bends no vertex and carries no socket once instead of every sample. | Nothing about it is ever drawn. |
| Share poses | Two meshes of one subject on one skeleton send one set of poses when one is almost never seen or both hold the same rotations. The mesh that draws more keeps them. | The receiver poses both from the same data, as the sender's animation did. |
| Resample | Keeps 30 samples per second, and 60 for the camera and each pawn's aim. | Playback blends between samples; aim and camera are what a viewer watches most closely. |
| Pack | Rotations take six bytes each by the smallest-three method, with bone rotations kept to 12 bits a component by default. Positions and bone translations become scaled integers. | Twelve bits resolve a few hundredths of a degree, far below what can be seen. |
| Store still channels once | A bone translation or scale that never moves is stored a single time. | It never changes. |
| Keep only needed keys | A bone sample is dropped when blending between the kept samples either side comes within 0.25 degrees and 0.03 units of it. | Playback blends, so the dropped sample is reproduced within the tolerance. |
| Delta and compress | Every value is written as its difference from the previous sample, then the whole stream is compressed with Oodle. | Small differences compress very well. |

Encoding touches no objects, so it runs on a worker thread. Asset paths are written into the clip first, on the game thread. Decoding is the reverse: the stream is rebuilt on any thread, then its asset paths are resolved back into assets on the game thread. A game can tune the reduction through `FVisualReplayClipEncodeOptions`. The kill cam exposes the rotation bits and key tolerances as console variables.

### Trusting what arrives

A clip comes from another player's machine, so the decoder treats every byte as untrusted. Every count read from the stream is checked against the bytes actually left before anything is allocated, along with hard limits on the stream's size, its bone counts, names, times and every other value it reads. A malformed clip fails to decode instead of crashing or allocating without limit.

Assets are only loaded if the asset registry lists them under the expected type, and classes are only used if already loaded, so a clip can't make the receiver load arbitrary content. The test `VisualReplay.Robustness.DecodeDamagedClips` damages valid clips at random and checks that each one either decodes or fails cleanly.

{% hint style="warning" %}
The stream carries no version number. Sender and receiver must run the same build, which a multiplayer game requires anyway.
{% endhint %}

***

## Joining Parts

A clip doesn't have to arrive in one piece. A sender can split its recording into parts by time and send the oldest first, so the receiver can start on the first while the rest arrive. Parts of one clip join by matching what they hold.

```
part 0  |=====================|
part 1                        |=====================|
joined  |===========================================|   tracks matched by the sender's track id,
                                                        samples appended after the last one held,
                                                        subjects matched by identity
```

* **Tracks** are matched by the sender's own track id, so the same mesh in two parts continues as one track. A part only adds samples later than the last one already held.
* **Subjects** are matched by identity, so two actors that have since been destroyed stay two subjects rather than collapsing into one.
* **Effect and decal intervals** are joined so the later part's history replaces the overlap.
* **The window and the camera** grow to cover both parts.

`VisualReplay::AppendPerspectiveClip` joins parts before a session starts. Once a session is running, `UVisualReplaySession::AppendPerspectiveClip` joins a part into it live: new tracks get mirrors, cosmetics that had nowhere to play are tried again, and the recording's end moves on, which is what releases a session waiting for more ([buffering](sessions.md)). A part that arrives while the session is still preparing is held until it is ready.

***

## Merging into a Session

When a session starts with a perspective clip, the clip takes over from this machine's own recording of its subjects:

* This machine's tracks for each subject, and for everything attached to or owned by it, are removed along with their effects, decals and lights. The live actors behind them are hidden from the viewer.
* The received tracks take their place, with ids moved out of the way of this machine's own.
* The session's camera becomes the sender's camera, available through `GetPerspectiveCamera`.

One detail keeps shells working. A received track of a subject's own root belongs to the subject. A received track of some other part, such as a weapon, is given **this machine's matching part** as its owner: the local part with the same owner class and the same mesh that overlaps it most in time. That part's shell then follows the received mirror, so a weapon's shell sits on the weapon the sender saw, and the effects it fires appear at the right muzzle.
